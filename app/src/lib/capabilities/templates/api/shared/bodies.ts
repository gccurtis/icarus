import type { VariableValue } from "$representation/data/types/content/variable-value";
import type { CellRef } from "$representation/data/types/content/formula-value";
import type {
  TemplatedResourceSet,
  TemplatedTerm
} from "$representation/data/types/core/resource-set";
import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import type {
  SpreadsheetTemplate,
  TemplateBody,
  TemplateVariable
} from "$representation/data/types/templates/template";

import type { RowFields } from "$capabilities/templates/api/shared/store";
import type { TemplateTarget } from "$capabilities/templates/types/templates";

const defaultPage = {
  paper: "letter" as const,
  orientation: "portrait" as const,
  margins: { top: 0.75, right: 0.75, bottom: 0.75, left: 0.75 }
};

const defaultStyles = {
  defaultKey: "body",
  styles: {
    body: { name: "Body", fontFamily: "IBM Plex Sans" }
  }
};

export const emptyTemplateBody = (target: TemplateTarget): TemplateBody => {
  if (target === "document") return { resource: "document", rows: [] };
  if (target === "slides") {
    return {
      resource: "slides",
      aspectRatio: "16:9",
      theme: {
        colors: {
          text: "--token-ink-primary",
          accent: "--token-color-accent-1-fill",
          muted: "--token-ink-muted"
        },
        fontFamily: "IBM Plex Sans"
      },
      styles: defaultStyles,
      layouts: [],
      slides: [],
      sections: []
    };
  }
  return {
    resource: "spreadsheet",
    cells: {},
    formatRules: [],
    print: { page: defaultPage, gridlines: true, headings: true },
    styles: defaultStyles
  };
};

type ResolvedTerm = Exclude<TemplatedTerm, { select: "variable" }>;
type ResolvedSet = {
  readonly include: readonly ResolvedTerm[];
  readonly exclude: readonly ResolvedTerm[];
};
type ExpandedTerms = {
  readonly same: readonly ResolvedTerm[];
  readonly opposite: readonly ResolvedTerm[];
};

const MAX_RESOLVED_TEMPLATE_TERMS = 10_000;
const TEMPLATE_DEFAULT_OVERFLOW = "template-default-resolution-overflow";
const TEMPLATE_DEFAULT_DIFFERENCE = "template-default-difference-is-not-flattenable";

/** Every stored occurrence owns its nested arrays; the file store rejects shared references. */
const cloneResolvedTerm = (term: ResolvedTerm): ResolvedTerm =>
  term.select === "kinds" ? { ...term, kinds: [...term.kinds] } : { ...term };

const cloneResolvedSet = (set: ResolvedSet): ResolvedSet => ({
  include: set.include.map(cloneResolvedTerm),
  exclude: set.exclude.map(cloneResolvedTerm)
});

type ResolvedDefaults =
  | { readonly accepted: true; readonly body: TemplateBody }
  | {
      readonly accepted: false;
      readonly reason: "variables-required";
      readonly variables: readonly string[];
    }
  | {
      readonly accepted: false;
      readonly reason: "unsupported-body";
      readonly detail: string;
    };

/**
 * Fills represented variable holes from represented defaults. There is no
 * caller-supplied answer shape yet, so an unbound hole is returned explicitly.
 */
export const resolveTemplateDefaults = (
  body: TemplateBody,
  variables: readonly TemplateVariable[]
): ResolvedDefaults => {
  const definitions = new Map(variables.map((variable) => [variable.name, variable]));
  const memo = new Map<string, ResolvedSet>();
  const missing = new Set<string>();
  let emittedTerms = 0;

  const append = (target: ResolvedTerm[], terms: readonly ResolvedTerm[]): void => {
    for (const term of terms) {
      emittedTerms += 1;
      if (emittedTerms > MAX_RESOLVED_TEMPLATE_TERMS) {
        throw new RangeError(TEMPLATE_DEFAULT_OVERFLOW);
      }
      target.push(cloneResolvedTerm(term));
    }
  };

  let resolveSet: (set: TemplatedResourceSet, stack?: readonly string[]) => ResolvedSet;

  const expandTerms = (
    terms: readonly TemplatedTerm[],
    stack: readonly string[]
  ): ExpandedTerms => {
    const same: ResolvedTerm[] = [];
    const opposite: ResolvedTerm[] = [];
    for (const term of terms) {
      if (term.select !== "variable") {
        append(same, [term]);
        continue;
      }
      const definition = definitions.get(term.name);
      if (definition?.default === undefined || stack.includes(term.name)) {
        missing.add(term.name);
        continue;
      }
      if (definition.default.exclude.length > 0) {
        throw new Error(TEMPLATE_DEFAULT_DIFFERENCE);
      }
      const cached = memo.get(term.name);
      const resolved =
        cached === undefined
          ? resolveSet(definition.default, [...stack, term.name])
          : cloneResolvedSet(cached);
      if (cached === undefined) memo.set(term.name, cloneResolvedSet(resolved));
      append(same, resolved.include);
      append(opposite, resolved.exclude);
    }
    return { same, opposite };
  };

  resolveSet = (
    set: TemplatedResourceSet,
    stack: readonly string[] = []
  ): ResolvedSet => {
    const included = expandTerms(set.include, stack);
    const excluded = expandTerms(set.exclude, stack);
    const include: ResolvedTerm[] = [];
    const exclude: ResolvedTerm[] = [];
    append(include, included.same);
    append(include, excluded.opposite);
    append(exclude, included.opposite);
    append(exclude, excluded.same);
    return { include, exclude };
  };

  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (value === null || typeof value !== "object") return value;
    const fields = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(fields).map(([field, nested]) => [
        field,
        fields.type === "prompt" && field === "scope" && nested !== undefined
          ? resolveSet(nested as TemplatedResourceSet)
          : walk(nested)
      ])
    );
  };

  try {
    const resolved = walk(body) as TemplateBody;
    return missing.size === 0
      ? { accepted: true, body: resolved }
      : {
          accepted: false,
          reason: "variables-required",
          variables: [...missing].sort()
        };
  } catch (error) {
    if (error instanceof Error && error.message === TEMPLATE_DEFAULT_DIFFERENCE) {
      return {
        accepted: false,
        reason: "unsupported-body",
        detail: "a variable default with exclusions cannot be flattened without changing scope"
      };
    }
    if (!(error instanceof RangeError) || error.message !== TEMPLATE_DEFAULT_OVERFLOW) throw error;
    return {
      accepted: false,
      reason: "unsupported-body",
      detail: `template defaults expand beyond ${MAX_RESOLVED_TEMPLATE_TERMS} terms`
    };
  }
};

type MaterializedCell = Omit<RowFields<"sheetCells">, "projectId" | "resourceId">;

export type MaterializedSpreadsheet = {
  readonly body: SpreadsheetBody;
  readonly cells: readonly MaterializedCell[];
};

export type TemplateAddress = { readonly column: string; readonly row: number };

export const MAX_TEMPLATE_ROWS = 10_000;
export const MAX_TEMPLATE_COLUMNS = 256;
export const MAX_TEMPLATE_CELLS = 20_000;
export const MAX_TEMPLATE_FORMAT_RULES = 1_000;

const rawColumnNumber = (label: string): number =>
  [...label].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);

export const templateColumnNumber = (value: string): number | undefined => {
  if (value.length === 0 || value.length > 3 || !/^[A-Z]+$/i.test(value)) return undefined;
  const number = rawColumnNumber(value.toUpperCase());
  return number <= MAX_TEMPLATE_COLUMNS ? number : undefined;
};

const templateRowNumber = (value: string): number | undefined => {
  if (value.length === 0 || value.length > 5 || !/^[1-9][0-9]*$/.test(value)) return undefined;
  const row = Number(value);
  return Number.isSafeInteger(row) && row <= MAX_TEMPLATE_ROWS ? row : undefined;
};

export const templateAddress = (value: string): TemplateAddress | undefined => {
  if (value.length > 9) return undefined;
  const match = /^([A-Z]+)([1-9][0-9]*)$/i.exec(value);
  if (match === null) return undefined;
  const column = templateColumnNumber(match[1]);
  const row = templateRowNumber(match[2]);
  return column === undefined || row === undefined
    ? undefined
    : { column: match[1].toUpperCase(), row };
};

export const validTemplateAddress = (value: string): boolean =>
  value === value.toUpperCase() && templateAddress(value) !== undefined;

const selectionParts = (value: string): readonly string[] | undefined => {
  if (value.length === 0 || value.length > 2_000) return undefined;
  const parts = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  return parts.length > 0 && parts.length <= 100 ? parts : undefined;
};

export const validTemplateRowSelection = (value: string): boolean => {
  const parts = selectionParts(value);
  return (
    parts !== undefined &&
    parts.every((part) => {
      const [from, to, ...extra] = part.split(":");
      return (
        extra.length === 0 &&
        templateRowNumber(from) !== undefined &&
        (to === undefined || templateRowNumber(to) !== undefined)
      );
    })
  );
};

export const validTemplateColumnSelection = (value: string): boolean => {
  const parts = selectionParts(value);
  return (
    parts !== undefined &&
    parts.every((part) => {
      if (part !== part.toUpperCase()) return false;
      const [from, to, ...extra] = part.split(":");
      return (
        extra.length === 0 &&
        templateColumnNumber(from) !== undefined &&
        (to === undefined || templateColumnNumber(to) !== undefined)
      );
    })
  );
};

const columnLabel = (number: number): string => {
  let value = number;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
};

const rowId = (row: number): string => `row-${row}`;
const columnId = (column: string): string => `column-${column}`;

const refOf = (address: string): CellRef | undefined => {
  const parsed = templateAddress(address);
  return parsed === undefined
    ? undefined
    : { rowId: rowId(parsed.row), columnId: columnId(parsed.column) };
};

const labelsIn = (value: string | undefined): readonly string[] => {
  if (value === undefined) return [];
  if (!validTemplateColumnSelection(value)) return [];
  const labels: string[] = [];
  for (const part of value.split(",").map((entry) => entry.trim()).filter(Boolean)) {
    const range = /^([A-Z]+):([A-Z]+)$/i.exec(part);
    if (range !== null) {
      const from = templateColumnNumber(range[1].toUpperCase())!;
      const to = templateColumnNumber(range[2].toUpperCase())!;
      for (let at = Math.min(from, to); at <= Math.max(from, to); at += 1) {
        labels.push(columnLabel(at));
      }
    } else if (/^[A-Z]+$/i.test(part)) {
      labels.push(part.toUpperCase());
    }
  }
  return [...new Set(labels)];
};

const rowsIn = (value: string | undefined): readonly number[] => {
  if (value === undefined) return [];
  if (!validTemplateRowSelection(value)) return [];
  const rows: number[] = [];
  for (const part of value.split(",").map((entry) => entry.trim()).filter(Boolean)) {
    const range = /^([1-9][0-9]*):([1-9][0-9]*)$/.exec(part);
    if (range !== null) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      for (let at = Math.min(from, to); at <= Math.max(from, to); at += 1) rows.push(at);
    } else if (/^[1-9][0-9]*$/.test(part)) {
      rows.push(Number(part));
    }
  }
  return [...new Set(rows)];
};

const dimensionsOf = (template: SpreadsheetTemplate): { rows: number; columns: number } => {
  const addresses = [
    ...Object.keys(template.cells),
    ...Object.values(template.cells).flatMap((cell) =>
      cell.merge === undefined ? [] : [cell.merge]
    ),
    ...template.formatRules.flatMap((rule) => [rule.from, rule.to]),
    ...(template.print.area === undefined
      ? []
      : [template.print.area.from, template.print.area.to])
  ]
    .map(templateAddress)
    .filter((address): address is TemplateAddress => address !== undefined);

  const rows = Math.max(
    20,
    ...addresses.map((address) => address.row),
    ...Object.keys(template.rowHeights ?? {})
      .map(templateRowNumber)
      .filter((row): row is number => row !== undefined),
    ...rowsIn(template.print.repeatRows),
    template.frozenRows ?? 0
  );
  const columns = Math.max(
    8,
    ...addresses.map((address) => templateColumnNumber(address.column)!),
    ...Object.keys(template.columnWidths ?? {})
      .map(templateColumnNumber)
      .filter((column): column is number => column !== undefined),
    ...labelsIn(template.print.repeatColumns).map((label) => templateColumnNumber(label)!),
    template.frozenColumns ?? 0
  );
  return { rows, columns };
};

const emptyValue = (): VariableValue => ({ kind: "empty" });

export const materializeSpreadsheet = (template: SpreadsheetTemplate): MaterializedSpreadsheet => {
  const dimensions = dimensionsOf(template);
  const rows = Array.from({ length: dimensions.rows }, (_, index) => ({
    id: rowId(index + 1),
    order: index,
    ...(template.rowHeights?.[String(index + 1)] === undefined
      ? {}
      : { height: template.rowHeights[String(index + 1)] })
  }));
  const columns = Array.from({ length: dimensions.columns }, (_, index) => {
    const label = columnLabel(index + 1);
    return {
      id: columnId(label),
      order: index,
      ...(template.columnWidths?.[label] === undefined
        ? {}
        : { width: template.columnWidths[label] })
    };
  });

  const cells = Object.entries(template.cells).flatMap<MaterializedCell>(([address, cell]) => {
    const parsed = templateAddress(address);
    if (parsed === undefined) return [];
    const mergedTo = cell.merge === undefined ? undefined : refOf(cell.merge);
    return [
      {
        rowId: rowId(parsed.row),
        columnId: columnId(parsed.column),
        rowOrder: parsed.row - 1,
        value: cell.value ?? emptyValue(),
        ...(cell.expression === undefined ? {} : { expression: cell.expression }),
        ...(cell.marks === undefined ? {} : { marks: cell.marks }),
        ...(cell.format === undefined ? {} : { format: cell.format }),
        ...(mergedTo === undefined ? {} : { mergedTo })
      }
    ];
  });

  const formatRules = template.formatRules.flatMap((rule, index) => {
    const from = refOf(rule.from);
    const to = refOf(rule.to);
    if (from === undefined || to === undefined) return [];
    return [
      {
        id: `rule-${index + 1}`,
        from,
        to,
        ...(rule.style === undefined ? {} : { style: rule.style }),
        ...(rule.format === undefined ? {} : { format: rule.format })
      }
    ];
  });
  const area = template.print.area;
  const areaFrom = area === undefined ? undefined : refOf(area.from);
  const areaTo = area === undefined ? undefined : refOf(area.to);
  const repeatRows = rowsIn(template.print.repeatRows).map(rowId);
  const repeatColumns = labelsIn(template.print.repeatColumns).map(columnId);

  return {
    body: {
      rows,
      columns,
      rowPartCounts: [rows.length],
      formatRules,
      ...(template.frozenRows === undefined ? {} : { frozenRows: template.frozenRows }),
      ...(template.frozenColumns === undefined ? {} : { frozenColumns: template.frozenColumns }),
      print: {
        page: template.print.page,
        ...(areaFrom === undefined || areaTo === undefined
          ? {}
          : { area: { from: areaFrom, to: areaTo } }),
        ...(repeatRows.length === 0 ? {} : { repeatRows }),
        ...(repeatColumns.length === 0 ? {} : { repeatColumns }),
        ...(template.print.scale === undefined ? {} : { scale: template.print.scale }),
        ...(template.print.gridlines === undefined
          ? {}
          : { gridlines: template.print.gridlines }),
        ...(template.print.headings === undefined ? {} : { headings: template.print.headings })
      },
      styles: template.styles
    },
    cells
  };
};

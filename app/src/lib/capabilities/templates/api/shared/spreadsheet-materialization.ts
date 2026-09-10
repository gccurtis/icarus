import type { VariableValue } from "$representation/data/types/content/variable-value";
import type { CellRef } from "$representation/data/types/content/formula-value";
import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import type { SpreadsheetTemplate } from "$representation/data/types/templates/template";

import type { RowFields } from "$capabilities/templates/api/shared/store";
import {
  type TemplateAddress,
  templateAddress,
  templateColumnLabel,
  templateColumnNumber,
  templateRowNumber,
  validTemplateColumnSelection,
  validTemplateRowSelection
} from "$capabilities/templates/api/shared/spreadsheet-address";

type MaterializedCell = Omit<RowFields<"sheetCells">, "projectId" | "resourceId">;

export type MaterializedSpreadsheet = {
  readonly body: SpreadsheetBody;
  readonly cells: readonly MaterializedCell[];
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
        labels.push(templateColumnLabel(at));
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
    const label = templateColumnLabel(index + 1);
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

  const formatRules = template.formatRules.flatMap((rule) => {
    const from = refOf(rule.from);
    const to = refOf(rule.to);
    if (from === undefined || to === undefined) return [];
    return [
      {
        id: rule.id,
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

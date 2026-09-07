import type {
  TemplateBody,
  TemplateVariable
} from "$representation/data/types/templates/template";
import type { ResourceSet, SetTerm } from "$representation/data/types/core/resource-set";
import { normalizeSlideDeckBody } from "$representation/data/behavior/slide-decks/normalize";

import type {
  TemplateAnswers,
  TemplateStageTarget,
  TemplateTarget
} from "$capabilities/templates/types/templates";
import {
  MAX_TEMPLATE_CELLS,
  MAX_TEMPLATE_COLUMNS,
  MAX_TEMPLATE_FORMAT_RULES,
  MAX_TEMPLATE_ROWS,
  templateAddress,
  templateColumnNumber,
  validTemplateAddress,
  validTemplateColumnSelection,
  validTemplateRowSelection
} from "$capabilities/templates/api/shared/bodies";

type Fields = Record<string, unknown>;

export const fieldsOf = (value: unknown, subject: string): Fields => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`templates/${subject}: an object is required`);
  }
  return value as Fields;
};

export const requiredId = (value: unknown, subject: string, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`templates/${subject}: ${field} is required`);
  }
  return value;
};

export const templateIdOf = (value: unknown, subject: string): string => {
  const id = requiredId(value, subject, "templateId");
  if (!/^templates:[^.:\s]+$/.test(id)) {
    throw new Error(`templates/${subject}: templateId is one canonical templates row id`);
  }
  return id;
};

export const revisionOf = (value: unknown, subject: string): number => {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new Error(`templates/${subject}: baseRevision is a safe positive revision number`);
  }
  return value;
};

export const targetOf = (value: unknown, subject: string): TemplateTarget => {
  if (value !== "document" && value !== "slides" && value !== "spreadsheet") {
    throw new Error(`templates/${subject}: target is document, slides, or spreadsheet`);
  }
  return value;
};

export const stageTargetOf = (value: unknown, subject: string): TemplateStageTarget => {
  if (value !== "document" && value !== "slides") {
    throw new Error(`templates/${subject}: target is document or slides`);
  }
  return value;
};

const rowIdOf = (value: unknown, subject: string, table: string, field: string): string => {
  const id = requiredId(value, subject, field);
  if (!new RegExp(`^${table}:[^.:\\s]+$`).test(id)) {
    throw new Error(`templates/${subject}: ${field} is one canonical ${table} row id`);
  }
  return id;
};

export const stageIdOf = (value: unknown, subject: string): string =>
  rowIdOf(value, subject, "templateStages", "stageId");

export const resourceIdOf = (value: unknown, subject: string): string => {
  const id = requiredId(value, subject, "resourceId");
  if (!/^(documents|slideDecks):[^.:\s]+$/.test(id)) {
    throw new Error(`templates/${subject}: resourceId is one canonical documents or slideDecks row id`);
  }
  return id;
};

export const slideIdOf = (value: unknown, subject: string): string => {
  if (typeof value !== "string" || value !== value.trim() || value.length === 0 || value.length > 500) {
    throw new Error(`templates/${subject}: slideId is an identifier`);
  }
  return value;
};

export const nameOf = (value: unknown, subject: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`templates/${subject}: name is required`);
  }
  const name = value.trim();
  if (name.length > 160) throw new Error(`templates/${subject}: name is at most 160 characters`);
  return name;
};

export const optionalNameOf = (value: unknown, subject: string): string | undefined =>
  value === undefined ? undefined : nameOf(value, subject);

export const descriptionOf = (value: unknown, subject: string): string => {
  if (typeof value !== "string") {
    throw new Error(`templates/${subject}: description is text`);
  }
  const description = value.trim();
  if (description.length > 4_000) {
    throw new Error(`templates/${subject}: description is at most 4000 characters`);
  }
  return description;
};

export const tagsOf = (value: unknown, subject: string): readonly string[] => {
  if (!Array.isArray(value)) throw new Error(`templates/${subject}: tags is a list of text`);
  if (value.length > 50) throw new Error(`templates/${subject}: a template has at most 50 tags`);

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`templates/${subject}: every tag is non-empty text`);
    }
    const tag = entry.trim();
    if (tag.length > 80) throw new Error(`templates/${subject}: a tag is at most 80 characters`);
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
};

const assertStoredValue = (value: unknown, subject: string): void => {
  const seen = new WeakSet<object>();
  const walk = (step: unknown) => {
    if (step === undefined) throw new Error(`templates/${subject}: undefined is not stored`);
    if (typeof step === "function" || typeof step === "symbol" || typeof step === "bigint") {
      throw new Error(`templates/${subject}: ${typeof step} is not stored`);
    }
    if (step === null || typeof step !== "object") return;
    if (seen.has(step)) throw new Error(`templates/${subject}: a stored value cannot contain a cycle`);
    seen.add(step);
    for (const nested of Object.values(step)) walk(nested);
  };
  walk(value);
};

const isRecord = (value: unknown): value is Fields =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === "string";
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const MAX_IDENTIFIER_LENGTH = 500;
const MAX_BLOCK_TEXT_LENGTH = 100_000;
const MAX_BLOCKS_PER_CONTAINER = 10_000;
const MAX_STYLES = 512;
const MAX_MARKS = 10_000;
const MAX_VALUE_DEPTH = 20;

const hasOnlyKeys = (value: Fields, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));

const validText = (value: unknown, maximum: number, allowEmpty = false): value is string =>
  isText(value) && value.length <= maximum && (allowEmpty || value.length > 0);

const validCanonicalText = (value: unknown, maximum: number): value is string =>
  validText(value, maximum) && value === value.trim();

const validIdentifier = (value: unknown): value is string =>
  validCanonicalText(value, MAX_IDENTIFIER_LENGTH);

const validInteger = (value: unknown, minimum: number, maximum: number): value is number =>
  isFiniteNumber(value) && Number.isInteger(value) && value >= minimum && value <= maximum;

const validFormat = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "horizontalAlignment",
      "verticalAlignment",
      "fontFamily",
      "fontSize",
      "color",
      "lineHeight",
      "spaceBefore",
      "spaceAfter",
      "indent",
      "background",
      "border",
      "padding",
      "valueFormat"
    ])
  ) {
    return false;
  }
  if (
    value.horizontalAlignment !== undefined &&
    !["start", "center", "end", "justify"].includes(value.horizontalAlignment as string)
  ) {
    return false;
  }
  if (
    value.verticalAlignment !== undefined &&
    !["top", "middle", "bottom"].includes(value.verticalAlignment as string)
  ) {
    return false;
  }
  for (const key of ["fontFamily", "color"] as const) {
    if (value[key] !== undefined && !validText(value[key], 1_000)) return false;
  }
  if (
    value.fontSize !== undefined &&
    (!isFiniteNumber(value.fontSize) || value.fontSize <= 0 || value.fontSize > 1_000)
  ) {
    return false;
  }
  if (
    value.lineHeight !== undefined &&
    (!isFiniteNumber(value.lineHeight) || value.lineHeight <= 0 || value.lineHeight > 100)
  ) {
    return false;
  }
  for (const key of ["spaceBefore", "spaceAfter", "indent"] as const) {
    if (
      value[key] !== undefined &&
      (!isFiniteNumber(value[key]) || (value[key] as number) < -10_000 || (value[key] as number) > 10_000)
    ) {
      return false;
    }
  }
  if (value.background !== undefined && !validText(value.background, 1_000)) return false;
  if (value.valueFormat !== undefined && !validText(value.valueFormat, 1_000, true)) return false;
  if (value.border !== undefined) {
    if (
      !isRecord(value.border) ||
      !hasOnlyKeys(value.border, ["color", "width", "style"]) ||
      !validText(value.border.color, 1_000) ||
      !isFiniteNumber(value.border.width) ||
      value.border.width < 0 ||
      value.border.width > 1_000 ||
      !["solid", "dashed", "dotted"].includes(value.border.style as string)
    ) {
      return false;
    }
  }
  if (value.padding !== undefined) {
    if (!isRecord(value.padding) || !hasOnlyKeys(value.padding, ["x", "y"])) return false;
    if (
      (value.padding.x !== undefined &&
        (!isFiniteNumber(value.padding.x) || value.padding.x < 0 || value.padding.x > 10_000)) ||
      (value.padding.y !== undefined &&
        (!isFiniteNumber(value.padding.y) || value.padding.y < 0 || value.padding.y > 10_000))
    ) {
      return false;
    }
  }
  return true;
};

const validTextStyle = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "name",
      "fontFamily",
      "fontSize",
      "fontWeight",
      "bold",
      "italic",
      "underline",
      "strikethrough",
      "color",
      "background",
      "lineHeight",
      "spaceBefore",
      "spaceAfter",
      "horizontalAlignment",
      "verticalAlignment",
      "indent"
    ]) ||
    !validCanonicalText(value.name, 160)
  ) {
    return false;
  }
  for (const key of ["fontFamily", "color", "background"] as const) {
    if (value[key] !== undefined && !validText(value[key], 1_000)) return false;
  }
  for (const key of ["bold", "italic", "underline", "strikethrough"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "boolean") return false;
  }
  if (
    value.fontSize !== undefined &&
    (!isFiniteNumber(value.fontSize) || value.fontSize <= 0 || value.fontSize > 1_000)
  ) {
    return false;
  }
  if (
    value.fontWeight !== undefined &&
    (!isFiniteNumber(value.fontWeight) || value.fontWeight < 1 || value.fontWeight > 1_000)
  ) {
    return false;
  }
  if (
    value.lineHeight !== undefined &&
    (!isFiniteNumber(value.lineHeight) || value.lineHeight <= 0 || value.lineHeight > 100)
  ) {
    return false;
  }
  for (const key of ["spaceBefore", "spaceAfter", "indent"] as const) {
    if (
      value[key] !== undefined &&
      (!isFiniteNumber(value[key]) || (value[key] as number) < -10_000 || (value[key] as number) > 10_000)
    ) {
      return false;
    }
  }
  return (
    (value.horizontalAlignment === undefined ||
      ["start", "center", "end", "justify"].includes(value.horizontalAlignment as string)) &&
    (value.verticalAlignment === undefined ||
      ["top", "middle", "bottom"].includes(value.verticalAlignment as string))
  );
};

const validStyles = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["defaultKey", "styles"]) ||
    !validIdentifier(value.defaultKey) ||
    !isRecord(value.styles) ||
    Object.keys(value.styles).length > MAX_STYLES
  ) {
    return false;
  }
  return Object.entries(value.styles).every(
    ([key, style]) => validIdentifier(key) && validTextStyle(style)
  );
};

const PAPER_DIMENSIONS: Readonly<Record<string, readonly [number, number]>> = {
  letter: [8.5, 11],
  legal: [8.5, 14],
  tabloid: [11, 17],
  a3: [11.69, 16.54],
  a4: [8.27, 11.69],
  a5: [5.83, 8.27]
};

const validPage = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["paper", "orientation", "margins"]) ||
    !isRecord(value.margins) ||
    !hasOnlyKeys(value.margins, ["top", "right", "bottom", "left"]) ||
    Object.keys(value.margins).length !== 4
  ) {
    return false;
  }
  const margins = value.margins;
  const paper = value.paper;
  const validPaper =
    (isText(paper) && ["letter", "legal", "tabloid", "a3", "a4", "a5"].includes(paper)) ||
    (isRecord(paper) &&
      hasOnlyKeys(paper, ["width", "height"]) &&
      Object.keys(paper).length === 2 &&
      isFiniteNumber(paper.width) &&
      paper.width > 0 &&
      paper.width <= 1_000 &&
      isFiniteNumber(paper.height) &&
      paper.height > 0 &&
      paper.height <= 1_000);
  if (
    !validPaper ||
    (value.orientation !== "portrait" && value.orientation !== "landscape") ||
    !["top", "right", "bottom", "left"].every(
      (key) =>
        isFiniteNumber(margins[key]) &&
        (margins[key] as number) >= 0 &&
        (margins[key] as number) <= 100
    )
  ) {
    return false;
  }
  const portrait = isText(paper)
    ? PAPER_DIMENSIONS[paper]
    : ([paper.width as number, paper.height as number] as const);
  const [width, height] =
    value.orientation === "portrait" ? portrait : ([portrait[1], portrait[0]] as const);
  return (
    (margins.left as number) + (margins.right as number) < width &&
    (margins.top as number) + (margins.bottom as number) < height
  );
};

const validCellRef = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["rowId", "columnId"]) &&
  Object.keys(value).length === 2 &&
  validIdentifier(value.rowId) &&
  validIdentifier(value.columnId);

const validFormulaValue = (value: unknown, depth = 0): boolean => {
  if (depth > MAX_VALUE_DEPTH || !isRecord(value) || !isText(value.kind)) return false;
  if (value.kind === "empty") return hasOnlyKeys(value, ["kind"]) && Object.keys(value).length === 1;
  if (value.kind === "number") {
    return hasOnlyKeys(value, ["kind", "value"]) && isFiniteNumber(value.value);
  }
  if (value.kind === "text") {
    return hasOnlyKeys(value, ["kind", "value"]) && validText(value.value, MAX_BLOCK_TEXT_LENGTH, true);
  }
  if (value.kind === "logic") {
    return hasOnlyKeys(value, ["kind", "value"]) && typeof value.value === "boolean";
  }
  if (value.kind === "date") {
    if (!hasOnlyKeys(value, ["kind", "value"]) || !isRecord(value.value)) return false;
    const date = value.value;
    return (
      hasOnlyKeys(date, [
        "calendar",
        "year",
        "month",
        "day",
        "hour",
        "minute",
        "second",
        "millisecond",
        "timeZone",
        "utc"
      ]) &&
      date.calendar === "gregorian" &&
      validInteger(date.year, -271_821, 275_760) &&
      validInteger(date.month, 1, 12) &&
      validInteger(date.day, 1, 31) &&
      (date.hour === undefined || validInteger(date.hour, 0, 23)) &&
      (date.minute === undefined || validInteger(date.minute, 0, 59)) &&
      (date.second === undefined || validInteger(date.second, 0, 59)) &&
      (date.millisecond === undefined || validInteger(date.millisecond, 0, 999)) &&
      (date.timeZone === undefined || validText(date.timeZone, 500)) &&
      isFiniteNumber(date.utc)
    );
  }
  if (value.kind === "list") {
    return (
      hasOnlyKeys(value, ["kind", "values"]) &&
      Array.isArray(value.values) &&
      value.values.length <= 10_000 &&
      value.values.every((entry) => validFormulaValue(entry, depth + 1))
    );
  }
  if (value.kind === "record") {
    return (
      hasOnlyKeys(value, ["kind", "fields"]) &&
      isRecord(value.fields) &&
      Object.keys(value.fields).length <= 10_000 &&
      Object.entries(value.fields).every(
        ([key, entry]) => validText(key, 1_000) && validFormulaValue(entry, depth + 1)
      )
    );
  }
  if (value.kind === "table") {
    if (
      !hasOnlyKeys(value, ["kind", "columns", "rows"]) ||
      !Array.isArray(value.columns) ||
      value.columns.length > MAX_TEMPLATE_COLUMNS ||
      !value.columns.every(
        (column) =>
          isRecord(column) &&
          hasOnlyKeys(column, ["name", "valueFormat"]) &&
          (column.name === undefined || validText(column.name, 1_000, true)) &&
          (column.valueFormat === undefined || validText(column.valueFormat, 1_000, true))
      ) ||
      !Array.isArray(value.rows) ||
      value.rows.length > MAX_TEMPLATE_ROWS
    ) {
      return false;
    }
    const columnCount = value.columns.length;
    return value.rows.every(
        (row) =>
          Array.isArray(row) &&
          row.length === columnCount &&
          row.every((entry) => validFormulaValue(entry, depth + 1))
    );
  }
  if (value.kind === "range") {
    return (
      hasOnlyKeys(value, ["kind", "resourceId", "from", "to"]) &&
      validIdentifier(value.resourceId) &&
      validCellRef(value.from) &&
      validCellRef(value.to)
    );
  }
  return (
    value.kind === "function" &&
    hasOnlyKeys(value, ["kind", "parameters", "formulaId"]) &&
    Array.isArray(value.parameters) &&
    value.parameters.length <= 1_000 &&
    value.parameters.every((parameter) => validCanonicalText(parameter, 500)) &&
    validIdentifier(value.formulaId)
  );
};

const validVariableValue = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (value.kind !== "reference") return validFormulaValue(value);
  if (!hasOnlyKeys(value, ["kind", "target"]) || !isRecord(value.target)) return false;
  if (value.target.to === "variable") {
    return (
      hasOnlyKeys(value.target, ["to", "name"]) && validCanonicalText(value.target.name, 160)
    );
  }
  return (
    value.target.to === "resource" &&
    hasOnlyKeys(value.target, ["to", "ref"]) &&
    isRecord(value.target.ref) &&
    hasOnlyKeys(value.target.ref, ["kind", "id"]) &&
    validCanonicalText(value.target.ref.kind, 160) &&
    validIdentifier(value.target.ref.id)
  );
};

const validActor = (value: unknown): boolean => {
  if (!isRecord(value) || !isText(value.kind)) return false;
  if (value.kind === "system") return hasOnlyKeys(value, ["kind"]);
  if (value.kind === "user") {
    return hasOnlyKeys(value, ["kind", "userId"]) && validIdentifier(value.userId);
  }
  if (value.kind === "agent") {
    return hasOnlyKeys(value, ["kind", "taskId"]) && validIdentifier(value.taskId);
  }
  return (
    value.kind === "connector" &&
    hasOnlyKeys(value, ["kind", "connectorId"]) &&
    validIdentifier(value.connectorId)
  );
};

const validMarkLink = (value: unknown): boolean => {
  if (!isRecord(value) || !isText(value.kind)) return false;
  if (value.kind === "url") {
    return (
      hasOnlyKeys(value, ["kind", "url", "note"]) &&
      validText(value.url, 10_000) &&
      (value.note === undefined || validText(value.note, 10_000))
    );
  }
  if (value.kind === "actor") {
    return hasOnlyKeys(value, ["kind", "actor"]) && validActor(value.actor);
  }
  if (value.kind === "persona") {
    return hasOnlyKeys(value, ["kind", "personaId"]) && validIdentifier(value.personaId);
  }
  return (
    value.kind === "resource" &&
    hasOnlyKeys(value, ["kind", "ref"]) &&
    isRecord(value.ref) &&
    hasOnlyKeys(value.ref, ["kind", "id"]) &&
    validCanonicalText(value.ref.kind, 160) &&
    validIdentifier(value.ref.id)
  );
};

const markEndOf = (value: unknown): { atom: string; offset: number } | undefined => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["atom", "offset"]) ||
    !validIdentifier(value.atom) ||
    !validInteger(value.offset, 0, MAX_BLOCK_TEXT_LENGTH)
  ) {
    return undefined;
  }
  return { atom: value.atom, offset: value.offset };
};

const markPosition = (
  atoms: readonly unknown[],
  end: { atom: string; offset: number }
): number | undefined => {
  let position = 0;
  for (const atom of atoms) {
    if (!isRecord(atom) || !validIdentifier(atom.id)) return undefined;
    const display =
      atom.kind === "literal"
        ? atom.text
        : atom.kind === "formula"
          ? atom.lastResolvedDisplay
          : undefined;
    if (!isText(display)) return undefined;
    if (atom.id === end.atom) return end.offset <= display.length ? position + end.offset : undefined;
    position += display.length;
  }
  return undefined;
};

const validMarks = (value: unknown, atoms?: readonly unknown[]): boolean =>
  Array.isArray(value) &&
  value.length <= MAX_MARKS &&
  value.every((mark) => {
    const from = isRecord(mark) ? markEndOf(mark.from) : undefined;
    const to = isRecord(mark) ? markEndOf(mark.to) : undefined;
    if (
      !isRecord(mark) ||
      !hasOnlyKeys(mark, ["id", "from", "to", "style", "link", "color", "background"]) ||
      !validIdentifier(mark.id) ||
      from === undefined ||
      to === undefined
    ) {
      return false;
    }
    if (atoms === undefined) {
      if (from.atom === to.atom && from.offset > to.offset) return false;
    } else {
      const fromPosition = markPosition(atoms, from);
      const toPosition = markPosition(atoms, to);
      if (fromPosition === undefined || toPosition === undefined || fromPosition > toPosition) {
        return false;
      }
    }
    if (
      mark.style !== undefined &&
      (!Array.isArray(mark.style) ||
        mark.style.length > 5 ||
        new Set(mark.style).size !== mark.style.length ||
        !mark.style.every((style) =>
          ["bold", "italic", "underline", "strikethrough", "code"].includes(style)
        ))
    ) {
      return false;
    }
    return (
      (mark.link === undefined || validMarkLink(mark.link)) &&
      (mark.color === undefined || validText(mark.color, 1_000)) &&
      (mark.background === undefined || validText(mark.background, 1_000))
    );
  });

const validAtom = (value: unknown): boolean => {
  if (!isRecord(value) || !validIdentifier(value.id)) return false;
  if (value.kind === "literal") {
    return (
      hasOnlyKeys(value, ["id", "kind", "text"]) &&
      validText(value.text, MAX_BLOCK_TEXT_LENGTH, true)
    );
  }
  if (value.kind === "template") {
    return (
      hasOnlyKeys(value, ["id", "kind", "name"]) &&
      validCanonicalText(value.name, MAX_VARIABLE_NAME_LENGTH)
    );
  }
  return (
    value.kind === "formula" &&
    hasOnlyKeys(value, [
      "id",
      "kind",
      "expression",
      "formulaId",
      "lastResolvedValue",
      "lastResolvedDisplay",
      "state",
      "error"
    ]) &&
    validText(value.expression, 10_000) &&
    (value.formulaId === undefined || validIdentifier(value.formulaId)) &&
    validFormulaValue(value.lastResolvedValue) &&
    validText(value.lastResolvedDisplay, MAX_BLOCK_TEXT_LENGTH, true) &&
    ["fresh", "stale", "computing", "error"].includes(value.state as string) &&
    (value.error === undefined || validText(value.error, 10_000, true))
  );
};

const displayOfAtoms = (atoms: readonly unknown[]): string =>
  atoms
    .map((atom) =>
      isRecord(atom) && atom.kind === "formula"
        ? (atom.lastResolvedDisplay as string)
        : isRecord(atom) && atom.kind === "template"
          ? `{${atom.name as string}}`
          : ((atom as Fields).text as string)
    )
    .join("");

const validBlock = (value: unknown, depth = 0): boolean => {
  if (depth > 12 || !isRecord(value) || !validIdentifier(value.id) || !isText(value.type)) {
    return false;
  }
  if (value.type === "text") {
    if (
      !hasOnlyKeys(value, [
        "id",
        "type",
        "variant",
        "level",
        "listStyle",
        "checked",
        "language",
        "style",
        "atoms",
        "display",
        "marks",
        "resolvedAt",
        "format"
      ]) ||
      !["paragraph", "heading", "list", "quote", "code"].includes(value.variant as string) ||
      !Array.isArray(value.atoms) ||
      value.atoms.length > MAX_BLOCKS_PER_CONTAINER ||
      !value.atoms.every(validAtom) ||
      !validText(value.display, MAX_BLOCK_TEXT_LENGTH, true) ||
      value.display !== displayOfAtoms(value.atoms) ||
      !validMarks(value.marks, value.atoms)
    ) {
      return false;
    }
    if (value.level !== undefined && !validInteger(value.level, 1, 9)) return false;
    if (
      value.listStyle !== undefined &&
      !["bullet", "ordered", "todo"].includes(value.listStyle as string)
    ) {
      return false;
    }
    return (
      (value.checked === undefined || typeof value.checked === "boolean") &&
      (value.language === undefined || validText(value.language, 500, true)) &&
      (value.style === undefined || validIdentifier(value.style)) &&
      (value.resolvedAt === undefined || (isFiniteNumber(value.resolvedAt) && value.resolvedAt >= 0)) &&
      (value.format === undefined || validFormat(value.format))
    );
  }
  if (value.type === "formula") {
    return (
      hasOnlyKeys(value, [
        "id",
        "type",
        "expression",
        "formulaId",
        "display",
        "value",
        "state",
        "error",
        "resolvedAt",
        "format"
      ]) &&
      validText(value.expression, 10_000) &&
      (value.formulaId === undefined || validIdentifier(value.formulaId)) &&
      validText(value.display, MAX_BLOCK_TEXT_LENGTH, true) &&
      validFormulaValue(value.value) &&
      ["fresh", "stale", "computing", "error"].includes(value.state as string) &&
      (value.error === undefined || validText(value.error, 10_000, true)) &&
      (value.resolvedAt === undefined || (isFiniteNumber(value.resolvedAt) && value.resolvedAt >= 0)) &&
      (value.format === undefined || validFormat(value.format))
    );
  }
  if (value.type === "image") {
    if (
      !hasOnlyKeys(value, ["id", "type", "source", "alt", "caption", "crop", "format"]) ||
      !validText(value.alt, 10_000, true)
    ) {
      return false;
    }
    if (value.source !== undefined) {
      if (!isRecord(value.source) || !isText(value.source.kind)) return false;
      if (value.source.kind === "url") {
        if (!hasOnlyKeys(value.source, ["kind", "url"]) || !validText(value.source.url, 10_000)) {
          return false;
        }
      } else if (value.source.kind === "file") {
        if (!hasOnlyKeys(value.source, ["kind", "fileId"]) || !validIdentifier(value.source.fileId)) {
          return false;
        }
      } else if (
        value.source.kind !== "storage" ||
        !hasOnlyKeys(value.source, ["kind", "storageId"]) ||
        !validIdentifier(value.source.storageId)
      ) {
        return false;
      }
    }
    if (
      value.caption !== undefined &&
      (!isRecord(value.caption) || value.caption.type !== "text" || !validBlock(value.caption, depth + 1))
    ) {
      return false;
    }
    if (value.crop !== undefined) {
      const crop = value.crop;
      if (
        !isRecord(crop) ||
        !hasOnlyKeys(crop, ["x", "y", "width", "height"]) ||
        !["x", "y", "width", "height"].every(
          (key) =>
            isFiniteNumber(crop[key]) &&
            (crop[key] as number) >= 0 &&
            (crop[key] as number) <= 1
        ) ||
        (crop.x as number) + (crop.width as number) > 1 ||
        (crop.y as number) + (crop.height as number) > 1
      ) {
        return false;
      }
    }
    return value.format === undefined || validFormat(value.format);
  }
  if (value.type === "table") {
    if (
      !hasOnlyKeys(value, ["id", "type", "rows", "headerRows", "columnWidths", "format"]) ||
      !Array.isArray(value.rows) ||
      value.rows.length > 1_000 ||
      !validInteger(value.headerRows, 0, value.rows.length)
    ) {
      return false;
    }
    const widths = value.columnWidths;
    if (
      widths !== undefined &&
      (!Array.isArray(widths) ||
        widths.length > MAX_TEMPLATE_COLUMNS ||
        !widths.every((width) => isFiniteNumber(width) && width > 0 && width <= 10_000))
    ) {
      return false;
    }
    return (
      value.rows.every(
        (row) =>
          isRecord(row) &&
          hasOnlyKeys(row, ["id", "cells"]) &&
          validIdentifier(row.id) &&
          Array.isArray(row.cells) &&
          row.cells.length <= MAX_TEMPLATE_COLUMNS &&
          row.cells.every(
            (cell) =>
              isRecord(cell) &&
              hasOnlyKeys(cell, ["id", "blocks", "rowSpan", "columnSpan", "format"]) &&
              validIdentifier(cell.id) &&
              Array.isArray(cell.blocks) &&
              cell.blocks.length <= MAX_BLOCKS_PER_CONTAINER &&
              cell.blocks.every((block) => validBlock(block, depth + 1)) &&
              (cell.rowSpan === undefined || validInteger(cell.rowSpan, 1, 1_000)) &&
              (cell.columnSpan === undefined || validInteger(cell.columnSpan, 1, MAX_TEMPLATE_COLUMNS)) &&
              (cell.format === undefined || validFormat(cell.format))
          )
      ) &&
      (value.format === undefined || validFormat(value.format))
    );
  }
  if (value.type === "prompt") {
    return (
      hasOnlyKeys(value, [
        "id",
        "type",
        "derivedOutputId",
        "atoms",
        "display",
        "marks",
        "scope",
        "state",
        "error",
        "refreshedAt",
        "format"
      ]) &&
      (value.derivedOutputId === undefined || validIdentifier(value.derivedOutputId)) &&
      Array.isArray(value.atoms) &&
      value.atoms.length <= MAX_BLOCKS_PER_CONTAINER &&
      value.atoms.every(validAtom) &&
      validText(value.display, MAX_BLOCK_TEXT_LENGTH, true) &&
      value.display === displayOfAtoms(value.atoms) &&
      validMarks(value.marks, value.atoms) &&
      (value.scope === undefined || validTemplatedSet(value.scope)) &&
      ["idle", "fresh", "stale", "generating", "error"].includes(value.state as string) &&
      (value.error === undefined || validText(value.error, 10_000, true)) &&
      (value.refreshedAt === undefined ||
        (isFiniteNumber(value.refreshedAt) && value.refreshedAt >= 0)) &&
      (value.format === undefined || validFormat(value.format))
    );
  }
  return false;
};

const addUniqueIdentifier = (seen: Set<string>, value: unknown): boolean => {
  if (!isText(value) || seen.has(value)) return false;
  seen.add(value);
  return true;
};

const collectBlockIdentifiers = (value: Fields, seen: Set<string>): boolean => {
  if (!addUniqueIdentifier(seen, value.id)) return false;
  if (value.type === "text" || value.type === "prompt") {
    for (const atom of value.atoms as Fields[]) {
      if (!addUniqueIdentifier(seen, atom.id)) return false;
    }
    for (const mark of value.marks as Fields[]) {
      if (!addUniqueIdentifier(seen, mark.id)) return false;
    }
  }
  if (value.type === "image" && isRecord(value.caption)) {
    if (!collectBlockIdentifiers(value.caption, seen)) return false;
  }
  if (value.type === "table") {
    for (const row of value.rows as Fields[]) {
      if (!addUniqueIdentifier(seen, row.id)) return false;
      for (const cell of row.cells as Fields[]) {
        if (!addUniqueIdentifier(seen, cell.id)) return false;
        for (const block of cell.blocks as Fields[]) {
          if (!collectBlockIdentifiers(block, seen)) return false;
        }
      }
    }
  }
  return true;
};

const collectBlocksIdentifiers = (value: unknown[], seen: Set<string>): boolean =>
  value.every((block) => collectBlockIdentifiers(block as Fields, seen));

const validDocumentRow = (candidate: unknown): boolean => {
  if (!isRecord(candidate) || !validIdentifier(candidate.id)) return false;
  if (candidate.kind === "blocks") {
    if (
      !hasOnlyKeys(candidate, ["id", "kind", "blocks", "proportions"]) ||
      !Array.isArray(candidate.blocks) ||
      candidate.blocks.length > MAX_BLOCKS_PER_CONTAINER ||
      !candidate.blocks.every((block) => validBlock(block))
    ) {
      return false;
    }
    return (
      candidate.proportions === undefined ||
      (Array.isArray(candidate.proportions) &&
        candidate.proportions.length === candidate.blocks.length &&
        candidate.proportions.every(
          (proportion) => isFiniteNumber(proportion) && proportion > 0
        ))
    );
  }
  if (candidate.kind === "divider") {
    return (
      hasOnlyKeys(candidate, ["id", "kind", "color", "width", "style"]) &&
      (candidate.color === undefined || validText(candidate.color, 1_000)) &&
      (candidate.width === undefined ||
        (isFiniteNumber(candidate.width) && candidate.width > 0 && candidate.width <= 1_000)) &&
      (candidate.style === undefined ||
        ["solid", "dashed", "dotted"].includes(candidate.style as string))
    );
  }
  return candidate.kind === "pageBreak" && hasOnlyKeys(candidate, ["id", "kind"]);
};

const validDocumentRows = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length <= MAX_TEMPLATE_ROWS &&
  value.every(validDocumentRow) &&
  new Set(value.map((row) => (row as Fields).id)).size === value.length;

const validPageNumber = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["position", "format", "startAt", "hideOnFirstPage"]) &&
  ["start", "center", "end"].includes(value.position as string) &&
  (value.format === undefined || validText(value.format, 1_000, true)) &&
  (value.startAt === undefined || validInteger(value.startAt, 1, 1_000_000)) &&
  (value.hideOnFirstPage === undefined || typeof value.hideOnFirstPage === "boolean");

const validFurniture = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["rows", "firstPageRows", "distanceFromEdge", "pageNumber"]) &&
  validDocumentRows(value.rows) &&
  (value.firstPageRows === undefined || validDocumentRows(value.firstPageRows)) &&
  isFiniteNumber(value.distanceFromEdge) &&
  value.distanceFromEdge >= 0 &&
  value.distanceFromEdge <= 100 &&
  (value.pageNumber === undefined || validPageNumber(value.pageNumber));

const collectDocumentRowsIdentifiers = (rows: unknown[], seen: Set<string>): boolean =>
  rows.every((row) => {
    const fields = row as Fields;
    return (
      addUniqueIdentifier(seen, fields.id) &&
      (fields.kind !== "blocks" || collectBlocksIdentifiers(fields.blocks as unknown[], seen))
    );
  });

const collectFurnitureIdentifiers = (value: unknown, seen: Set<string>): boolean => {
  if (!isRecord(value)) return true;
  return (
    collectDocumentRowsIdentifiers(value.rows as unknown[], seen) &&
    (value.firstPageRows === undefined ||
      collectDocumentRowsIdentifiers(value.firstPageRows as unknown[], seen))
  );
};

const validDocument = (body: Fields): boolean => {
  if (
    !hasOnlyKeys(body, ["resource", "pageSetup", "styles", "rows", "header", "footer"]) ||
    !validDocumentRows(body.rows) ||
    (body.pageSetup !== undefined && !validPage(body.pageSetup)) ||
    (body.styles !== undefined && !validStyles(body.styles)) ||
    (body.header !== undefined && !validFurniture(body.header)) ||
    (body.footer !== undefined && !validFurniture(body.footer))
  ) {
    return false;
  }
  const identifiers = new Set<string>();
  return (
    collectDocumentRowsIdentifiers(body.rows as unknown[], identifiers) &&
    collectFurnitureIdentifiers(body.header, identifiers) &&
    collectFurnitureIdentifiers(body.footer, identifiers)
  );
};

const validFrame = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["x", "y", "width", "height"]) &&
  Object.keys(value).length === 4 &&
  isFiniteNumber(value.x) &&
  isFiniteNumber(value.y) &&
  isFiniteNumber(value.width) &&
  isFiniteNumber(value.height);

const validSlideBackground = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (value.kind === "color") {
    return hasOnlyKeys(value, ["kind", "color"]) && validText(value.color, 1_000);
  }
  return (
    value.kind === "image" &&
    hasOnlyKeys(value, ["kind", "fileId", "fit"]) &&
    validIdentifier(value.fileId) &&
    (value.fit === "cover" || value.fit === "contain")
  );
};

const validPoint = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["x", "y"]) &&
  Object.keys(value).length === 2 &&
  isFiniteNumber(value.x) &&
  isFiniteNumber(value.y);

const validElementPaint = (value: unknown): boolean => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["fill", "stroke", "opacity", "cornerRadius", "shadow"])
  ) {
    return false;
  }
  if (value.fill !== undefined && !validText(value.fill, 1_000)) return false;
  if (value.stroke !== undefined) {
    if (
      !isRecord(value.stroke) ||
      !hasOnlyKeys(value.stroke, ["color", "width", "dash"]) ||
      !validText(value.stroke.color, 1_000) ||
      !isFiniteNumber(value.stroke.width) ||
      value.stroke.width < 0 ||
      value.stroke.width > 1_000 ||
      (value.stroke.dash !== undefined &&
        !["solid", "dashed", "dotted"].includes(value.stroke.dash as string))
    ) {
      return false;
    }
  }
  if (
    value.opacity !== undefined &&
    (!isFiniteNumber(value.opacity) || value.opacity < 0 || value.opacity > 1)
  ) {
    return false;
  }
  if (
    value.cornerRadius !== undefined &&
    (!isFiniteNumber(value.cornerRadius) || value.cornerRadius < 0 || value.cornerRadius > 10_000)
  ) {
    return false;
  }
  if (value.shadow !== undefined) {
    if (
      !isRecord(value.shadow) ||
      !hasOnlyKeys(value.shadow, ["color", "x", "y", "blur"]) ||
      !validText(value.shadow.color, 1_000) ||
      !isFiniteNumber(value.shadow.x) ||
      Math.abs(value.shadow.x) > 10_000 ||
      !isFiniteNumber(value.shadow.y) ||
      Math.abs(value.shadow.y) > 10_000 ||
      !isFiniteNumber(value.shadow.blur) ||
      value.shadow.blur < 0 ||
      value.shadow.blur > 10_000
    ) {
      return false;
    }
  }
  return true;
};

const validBlockOfType = (value: unknown, type: string): boolean =>
  isRecord(value) && value.type === type && validBlock(value);

const validLineEnds = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["start", "end"]) &&
  [value.start, value.end].every(
    (end) => end === undefined || ["none", "arrow", "dot"].includes(end as string)
  );

function validElementContent(value: unknown, depth: number): boolean {
  if (!isRecord(value) || depth > 12 || !isText(value.type)) return false;
  if (
    value.type === "text" ||
    value.type === "formula" ||
    value.type === "prompt" ||
    value.type === "image"
  ) {
    return (
      hasOnlyKeys(value, ["type", "block"]) &&
      validBlockOfType(value.block, value.type)
    );
  }
  if (value.type === "shape") {
    return (
      hasOnlyKeys(value, ["type", "shape", "block"]) &&
      ["rectangle", "ellipse", "triangle", "diamond", "arrow", "callout"].includes(
        value.shape as string
      ) &&
      (value.block === undefined || validBlockOfType(value.block, "text"))
    );
  }
  if (value.type === "line") {
    return (
      hasOnlyKeys(value, ["type", "from", "to", "ends"]) &&
      validPoint(value.from) &&
      validPoint(value.to) &&
      (value.ends === undefined || validLineEnds(value.ends))
    );
  }
  if (value.type === "table") {
    return (
      hasOnlyKeys(value, ["type", "block", "rowHeights"]) &&
      validBlockOfType(value.block, "table") &&
      (value.rowHeights === undefined ||
        (Array.isArray(value.rowHeights) &&
          value.rowHeights.length <= 1_000 &&
          value.rowHeights.every(
            (height) => isFiniteNumber(height) && height > 0 && height <= 10_000
          )))
    );
  }
  if (value.type === "chart") {
    return hasOnlyKeys(value, ["type", "spec"]) && isRecord(value.spec);
  }
  return (
    value.type === "group" &&
    hasOnlyKeys(value, ["type", "children"]) &&
    Array.isArray(value.children) &&
    value.children.length <= 2_000 &&
    value.children.every((child) => validSlideElement(child, depth + 1))
  );
}

function validSlideElement(value: unknown, depth = 0): boolean {
  return (
    depth <= 12 &&
    isRecord(value) &&
    hasOnlyKeys(value, [
      "id",
      "frame",
      "rotation",
      "overflow",
      "paint",
      "locked",
      "fromPlaceholder",
      "content"
    ]) &&
    validIdentifier(value.id) &&
    validFrame(value.frame) &&
    (value.rotation === undefined ||
      (isFiniteNumber(value.rotation) && value.rotation >= -36_000 && value.rotation <= 36_000)) &&
    (value.overflow === undefined || ["clip", "shrink", "grow"].includes(value.overflow as string)) &&
    (value.paint === undefined || validElementPaint(value.paint)) &&
    (value.locked === undefined || typeof value.locked === "boolean") &&
    (value.fromPlaceholder === undefined || validIdentifier(value.fromPlaceholder)) &&
    validElementContent(value.content, depth)
  );
}

const collectSlideElementIdentifiers = (value: Fields, seen: Set<string>): boolean => {
  if (!addUniqueIdentifier(seen, value.id) || !isRecord(value.content)) return false;
  const content = value.content;
  if (["text", "formula", "prompt", "image", "table"].includes(content.type as string)) {
    return collectBlockIdentifiers(content.block as Fields, seen);
  }
  if (content.type === "shape" && isRecord(content.block)) {
    return collectBlockIdentifiers(content.block, seen);
  }
  if (content.type === "group") {
    return (content.children as Fields[]).every((child) =>
      collectSlideElementIdentifiers(child, seen)
    );
  }
  return true;
};

const slideElementsUseOnlyRoles = (
  elements: unknown[],
  roles: ReadonlySet<string>
): boolean =>
  elements.every((element) => {
    if (!isRecord(element) || !isRecord(element.content)) return false;
    if (
      element.fromPlaceholder !== undefined &&
      !roles.has(element.fromPlaceholder as string)
    ) {
      return false;
    }
    return (
      element.content.type !== "group" ||
      slideElementsUseOnlyRoles(element.content.children as unknown[], roles)
    );
  });

const validAspectRatio = (value: unknown): boolean => {
  if (!isText(value) || !/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(value)) return false;
  const [width, height] = value.split(":").map(Number);
  return width > 0 && width <= 10_000 && height > 0 && height <= 10_000;
};

const validSlides = (body: Fields): boolean => {
  if (
    !hasOnlyKeys(body, ["resource", "aspectRatio", "theme", "styles", "layouts", "slides", "sections"]) ||
    !validAspectRatio(body.aspectRatio) ||
    !isRecord(body.theme) ||
    !hasOnlyKeys(body.theme, ["background", "colors", "fontFamily"]) ||
    !isRecord(body.theme.colors) ||
    !hasOnlyKeys(body.theme.colors, ["text", "accent", "muted"]) ||
    !validText(body.theme.colors.text, 1_000) ||
    !validText(body.theme.colors.accent, 1_000) ||
    (body.theme.colors.muted !== undefined && !validText(body.theme.colors.muted, 1_000)) ||
    (body.theme.background !== undefined && !validSlideBackground(body.theme.background)) ||
    (body.theme.fontFamily !== undefined && !validText(body.theme.fontFamily, 1_000)) ||
    !validStyles(body.styles) ||
    !Array.isArray(body.layouts) ||
    body.layouts.length > 512 ||
    !Array.isArray(body.slides) ||
    body.slides.length > 10_000 ||
    !Array.isArray(body.sections) ||
    body.sections.length > 1_000
  ) {
    return false;
  }
  const styles = (body.styles as Fields).styles as Fields;
  const identifiers = new Set<string>();
  const layoutKeys = new Set<string>();
  const placeholdersByLayout = new Map<string, Set<string>>();
  for (const layout of body.layouts) {
    if (
      !isRecord(layout) ||
      !hasOnlyKeys(layout, ["id", "key", "name", "locked", "placeholders", "background"]) ||
      !validIdentifier(layout.id) ||
      !validIdentifier(layout.key) ||
      layoutKeys.has(layout.key) ||
      !validCanonicalText(layout.name, 500) ||
      !Array.isArray(layout.locked) ||
      layout.locked.length > 2_000 ||
      !layout.locked.every((element) => validSlideElement(element)) ||
      !Array.isArray(layout.placeholders) ||
      layout.placeholders.length > 2_000 ||
      (layout.background !== undefined && !validSlideBackground(layout.background))
    ) {
      return false;
    }
    if (
      !addUniqueIdentifier(identifiers, layout.id) ||
      !layout.locked.every((element) =>
        collectSlideElementIdentifiers(element as Fields, identifiers)
      )
    ) {
      return false;
    }
    const roles = new Set<string>();
    for (const placeholder of layout.placeholders) {
      if (
        !isRecord(placeholder) ||
        !hasOnlyKeys(placeholder, ["role", "frame", "styleKey", "prompt"]) ||
        !validIdentifier(placeholder.role) ||
        roles.has(placeholder.role) ||
        !validFrame(placeholder.frame) ||
        (placeholder.styleKey !== undefined &&
          (!validIdentifier(placeholder.styleKey) ||
            !Object.prototype.hasOwnProperty.call(styles, placeholder.styleKey))) ||
        (placeholder.prompt !== undefined && !validText(placeholder.prompt, 4_000, true))
      ) {
        return false;
      }
      roles.add(placeholder.role);
    }
    if (
      !slideElementsUseOnlyRoles(layout.locked, roles)
    ) {
      return false;
    }
    layoutKeys.add(layout.key);
    placeholdersByLayout.set(layout.key, roles);
  }

  const slideIds = new Set<string>();
  for (const slide of body.slides) {
    if (
      !isRecord(slide) ||
      !hasOnlyKeys(slide, ["id", "layoutKey", "elements", "notes", "background", "hidden"]) ||
      !validIdentifier(slide.id) ||
      slideIds.has(slide.id) ||
      (slide.layoutKey !== undefined &&
        (!validIdentifier(slide.layoutKey) || !layoutKeys.has(slide.layoutKey))) ||
      !Array.isArray(slide.notes) ||
      slide.notes.length > MAX_BLOCKS_PER_CONTAINER ||
      !slide.notes.every((block) => validBlock(block)) ||
      !Array.isArray(slide.elements) ||
      slide.elements.length > 2_000 ||
      !slide.elements.every((element) => validSlideElement(element)) ||
      (slide.background !== undefined && !validSlideBackground(slide.background)) ||
      (slide.hidden !== undefined && typeof slide.hidden !== "boolean")
    ) {
      return false;
    }
    if (
      !addUniqueIdentifier(identifiers, slide.id) ||
      !collectBlocksIdentifiers(slide.notes, identifiers) ||
      !slide.elements.every((element) =>
        collectSlideElementIdentifiers(element as Fields, identifiers)
      )
    ) {
      return false;
    }
    const roles =
      slide.layoutKey === undefined ? undefined : placeholdersByLayout.get(slide.layoutKey);
    if (
      (roles === undefined
        ? !slideElementsUseOnlyRoles(slide.elements, new Set())
        : !slideElementsUseOnlyRoles(slide.elements, roles))
    ) {
      return false;
    }
    slideIds.add(slide.id);
  }

  const sectionIds = new Set<string>();
  return body.sections.every((section) => {
    if (
      !isRecord(section) ||
      !hasOnlyKeys(section, ["id", "name", "firstSlideId"]) ||
      !validIdentifier(section.id) ||
      sectionIds.has(section.id) ||
      !validCanonicalText(section.name, 500) ||
      !validIdentifier(section.firstSlideId) ||
      !slideIds.has(section.firstSlideId)
    ) {
      return false;
    }
    if (!addUniqueIdentifier(identifiers, section.id)) return false;
    sectionIds.add(section.id);
    return true;
  });
};

const validSize = (value: unknown): boolean =>
  isFiniteNumber(value) && value > 0 && value <= 10_000;

const orderedAddressRange = (from: string, to: string): boolean => {
  const start = templateAddress(from);
  const end = templateAddress(to);
  if (start === undefined || end === undefined) return false;
  const startColumn = templateColumnNumber(start.column);
  const endColumn = templateColumnNumber(end.column);
  return (
    startColumn !== undefined &&
    endColumn !== undefined &&
    end.row >= start.row &&
    endColumn >= startColumn
  );
};

const orderedRowSelection = (value: string): boolean =>
  validTemplateRowSelection(value) &&
  value.split(",").every((part) => {
    const [from, to] = part.trim().split(":");
    return to === undefined || Number(to) >= Number(from);
  });

const orderedColumnSelection = (value: string): boolean =>
  validTemplateColumnSelection(value) &&
  value.split(",").every((part) => {
    const [from, to] = part.trim().split(":");
    const start = templateColumnNumber(from);
    const end = to === undefined ? start : templateColumnNumber(to);
    return start !== undefined && end !== undefined && end >= start;
  });

const validSpreadsheet = (body: Fields): boolean => {
  if (
    !hasOnlyKeys(body, [
      "resource",
      "cells",
      "columnWidths",
      "rowHeights",
      "formatRules",
      "frozenRows",
      "frozenColumns",
      "print",
      "styles"
    ]) ||
    !isRecord(body.cells) ||
    Object.keys(body.cells).length > MAX_TEMPLATE_CELLS
  ) {
    return false;
  }
  if (
    !Object.entries(body.cells).every(
      ([address, cell]) => {
        if (
          !validTemplateAddress(address) ||
          !isRecord(cell) ||
          !hasOnlyKeys(cell, ["value", "expression", "marks", "format", "merge"])
        ) {
          return false;
        }
        if (
          cell.expression !== undefined &&
          !validText(cell.expression, 10_000)
        ) {
          return false;
        }
        if (cell.merge !== undefined) {
          if (
            !isText(cell.merge) ||
            !validTemplateAddress(cell.merge) ||
            !orderedAddressRange(address, cell.merge)
          ) {
            return false;
          }
        }
        return (
          (cell.marks === undefined || validMarks(cell.marks)) &&
          (cell.format === undefined || validFormat(cell.format)) &&
          (cell.value === undefined || validVariableValue(cell.value))
        );
      }
    )
  ) {
    return false;
  }
  if (
    body.columnWidths !== undefined &&
    (!isRecord(body.columnWidths) ||
      Object.keys(body.columnWidths).length > MAX_TEMPLATE_COLUMNS ||
      !Object.entries(body.columnWidths).every(
        ([label, width]) =>
          label === label.toUpperCase() && templateColumnNumber(label) !== undefined && validSize(width)
      ))
  ) {
    return false;
  }
  if (
    body.rowHeights !== undefined &&
    (!isRecord(body.rowHeights) ||
      Object.keys(body.rowHeights).length > MAX_TEMPLATE_ROWS ||
      !Object.entries(body.rowHeights).every(
        ([label, height]) =>
          /^[1-9][0-9]*$/.test(label) && Number(label) <= MAX_TEMPLATE_ROWS && validSize(height)
      ))
  ) {
    return false;
  }
  if (
    !Array.isArray(body.formatRules) ||
    body.formatRules.length > MAX_TEMPLATE_FORMAT_RULES ||
    !body.formatRules.every(
      (rule) =>
        isRecord(rule) &&
        hasOnlyKeys(rule, ["from", "to", "style", "format"]) &&
        isText(rule.from) &&
        validTemplateAddress(rule.from) &&
        isText(rule.to) &&
        validTemplateAddress(rule.to) &&
        orderedAddressRange(rule.from, rule.to) &&
        (rule.style === undefined || validIdentifier(rule.style)) &&
        (rule.format === undefined || validFormat(rule.format))
    )
  ) {
    return false;
  }
  if (
    !isRecord(body.print) ||
    !hasOnlyKeys(body.print, [
      "page",
      "area",
      "repeatRows",
      "repeatColumns",
      "scale",
      "gridlines",
      "headings"
    ]) ||
    !validPage(body.print.page)
  ) {
    return false;
  }
  const print = body.print;
  if (
    print.area !== undefined &&
    (!isRecord(print.area) ||
      !hasOnlyKeys(print.area, ["from", "to"]) ||
      Object.keys(print.area).length !== 2 ||
      !isText(print.area.from) ||
      !validTemplateAddress(print.area.from) ||
      !isText(print.area.to) ||
      !validTemplateAddress(print.area.to) ||
      !orderedAddressRange(print.area.from, print.area.to))
  ) {
    return false;
  }
  if (
    print.repeatRows !== undefined &&
    (!isText(print.repeatRows) || !orderedRowSelection(print.repeatRows))
  ) {
    return false;
  }
  if (
    print.repeatColumns !== undefined &&
    (!isText(print.repeatColumns) || !orderedColumnSelection(print.repeatColumns))
  ) {
    return false;
  }
  if (
    print.scale !== undefined &&
    print.scale !== "fit-width" &&
    print.scale !== "fit-page" &&
    !(isFiniteNumber(print.scale) && print.scale > 0 && print.scale <= 10_000)
  ) {
    return false;
  }
  if (print.gridlines !== undefined && typeof print.gridlines !== "boolean") return false;
  if (print.headings !== undefined && typeof print.headings !== "boolean") return false;
  if (
    body.frozenRows !== undefined &&
    (!Number.isInteger(body.frozenRows) ||
      (body.frozenRows as number) < 0 ||
      (body.frozenRows as number) > MAX_TEMPLATE_ROWS)
  ) {
    return false;
  }
  if (
    body.frozenColumns !== undefined &&
    (!Number.isInteger(body.frozenColumns) ||
      (body.frozenColumns as number) < 0 ||
      (body.frozenColumns as number) > MAX_TEMPLATE_COLUMNS)
  ) {
    return false;
  }
  return validStyles(body.styles);
};

const assertPortableBody = (value: unknown, subject: string): void => {
  const boundField = (step: Fields): string | undefined => {
    if (step.to === "resource" && "ref" in step) return "resource reference";
    if (step.kind === "resource" && "ref" in step) return "resource reference";
    if (step.kind === "range" && "resourceId" in step) return "resourceId";
    if (step.kind === "function" && "formulaId" in step) return "formulaId";
    if ((step.kind === "formula" || step.type === "formula") && "formulaId" in step) {
      return "formulaId";
    }
    if (step.type === "prompt" && "derivedOutputId" in step) return "derivedOutputId";
    if (step.kind === "user" && "userId" in step) return "userId";
    if (step.kind === "agent" && "taskId" in step) return "taskId";
    if (step.kind === "connector" && "connectorId" in step) return "connectorId";
    if (step.kind === "persona" && "personaId" in step) return "personaId";
    if (step.kind === "file" && "fileId" in step) return "fileId";
    if (step.kind === "storage" && "storageId" in step) return "storageId";
    if (step.kind === "image" && "fileId" in step) return "fileId";
    return undefined;
  };

  const walk = (step: unknown): void => {
    if (Array.isArray(step)) {
      for (const nested of step) walk(nested);
      return;
    }
    if (!isRecord(step)) return;
    const field = boundField(step);
    if (field !== undefined) {
      throw new Error(`templates/${subject}: body contains project-bound field ${field}`);
    }
    for (const nested of Object.values(step)) walk(nested);
  };
  walk(value);
};

export const bodyOf = (value: unknown, subject: string): TemplateBody => {
  assertStoredValue(value, subject);
  assertPortableBody(value, subject);
  const raw = fieldsOf(value, subject);
  const target = targetOf(raw.resource, subject);
  const normalized =
    target === "slides" ? { ...normalizeSlideDeckBody(raw), resource: target } : value;
  const body = fieldsOf(normalized, subject);
  const valid =
    target === "document"
      ? validDocument(body)
      : target === "slides"
        ? validSlides(body)
        : validSpreadsheet(body);
  if (!valid) {
    throw new Error(`templates/${subject}: body is not a valid ${target} template body`);
  }
  return normalized as TemplateBody;
};

const validSetTerm = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (value.select === "project") return Object.keys(value).length === 1;
  if (value.select === "kinds") return validTerm(value);
  if (value.select === "set") {
    return (
      hasOnlyKeys(value, ["select", "setId"]) &&
      typeof value.setId === "string" &&
      /^resourceSets:[^.:\s]+$/.test(value.setId)
    );
  }
  return (
    value.select === "resources" &&
    hasOnlyKeys(value, ["select", "refs"]) &&
    Array.isArray(value.refs) &&
    value.refs.length <= 1_000 &&
    value.refs.every(
      (ref) =>
        isRecord(ref) &&
        hasOnlyKeys(ref, ["kind", "id"]) &&
        validCanonicalText(ref.kind, MAX_RESOURCE_KIND_LENGTH) &&
        validIdentifier(ref.id)
    )
  );
};

export const resourceSetOf = (value: unknown, subject: string): ResourceSet => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["include", "exclude"]) ||
    !Array.isArray(value.include) ||
    !Array.isArray(value.exclude) ||
    value.include.length > MAX_TEMPLATE_TERMS_PER_SIDE ||
    value.exclude.length > MAX_TEMPLATE_TERMS_PER_SIDE ||
    !value.include.every(validSetTerm) ||
    !value.exclude.every(validSetTerm)
  ) {
    throw new Error(`templates/${subject}: a resource set is an include list and an exclude list`);
  }
  return {
    include: (value.include as SetTerm[]).map((term) => structuredClone(term)),
    exclude: (value.exclude as SetTerm[]).map((term) => structuredClone(term))
  };
};

export const answersOf = (value: unknown, subject: string): TemplateAnswers => {
  if (!isRecord(value)) {
    throw new Error(`templates/${subject}: answers map variable names to resource sets`);
  }
  const entries = Object.entries(value);
  if (entries.length > MAX_TEMPLATE_VARIABLES) {
    throw new Error(`templates/${subject}: at most ${MAX_TEMPLATE_VARIABLES} variables are answered`);
  }
  const answers: Record<string, ResourceSet> = {};
  for (const [name, answer] of entries) {
    if (!validCanonicalText(name, MAX_VARIABLE_NAME_LENGTH)) {
      throw new Error(`templates/${subject}: every answered variable has a name`);
    }
    answers[name] = resourceSetOf(answer, subject);
  }
  return answers;
};

/** The words a caller filled the template's text parameters in with. */
export const textsOf = (value: unknown, subject: string): Readonly<Record<string, string>> => {
  if (!isRecord(value)) {
    throw new Error(`templates/${subject}: texts map variable names to words`);
  }
  const entries = Object.entries(value);
  if (entries.length > MAX_TEMPLATE_VARIABLES) {
    throw new Error(`templates/${subject}: at most ${MAX_TEMPLATE_VARIABLES} variables are answered`);
  }
  const texts: Record<string, string> = {};
  for (const [name, words] of entries) {
    if (!validCanonicalText(name, MAX_VARIABLE_NAME_LENGTH)) {
      throw new Error(`templates/${subject}: every answered variable has a name`);
    }
    if (!validText(words, MAX_BLOCK_TEXT_LENGTH, true)) {
      throw new Error(`templates/${subject}: a text answer is words`);
    }
    texts[name] = words as string;
  }
  return texts;
};

const MAX_TEMPLATE_VARIABLES = 100;
const MAX_TEMPLATE_TERMS_PER_SIDE = 100;
const MAX_TEMPLATE_KINDS_PER_TERM = 100;
const MAX_VARIABLE_NAME_LENGTH = 160;
const MAX_VARIABLE_LABEL_LENGTH = 500;
const MAX_VARIABLE_DESCRIPTION_LENGTH = 4_000;
const MAX_RESOURCE_KIND_LENGTH = 160;

const validTerm = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  if (value.select === "project") {
    return hasOnlyKeys(value, ["select"]) && Object.keys(value).length === 1;
  }
  if (value.select === "variable") {
    return (
      hasOnlyKeys(value, ["select", "name"]) &&
      Object.keys(value).length === 2 &&
      validCanonicalText(value.name, MAX_VARIABLE_NAME_LENGTH)
    );
  }
  if (value.select === "set") {
    return (
      hasOnlyKeys(value, ["select", "setId"]) &&
      Object.keys(value).length === 2 &&
      typeof value.setId === "string" &&
      /^resourceSets:[^.:\s]+$/.test(value.setId)
    );
  }
  if (
    value.select !== "kinds" ||
    !hasOnlyKeys(value, ["select", "kinds"]) ||
    Object.keys(value).length !== 2 ||
    !Array.isArray(value.kinds) ||
    value.kinds.length === 0 ||
    value.kinds.length > MAX_TEMPLATE_KINDS_PER_TERM ||
    !value.kinds.every((kind) => validCanonicalText(kind, MAX_RESOURCE_KIND_LENGTH))
  ) {
    return false;
  }
  return new Set(value.kinds.map((kind) => kind.toLocaleLowerCase())).size === value.kinds.length;
};

const validTemplatedSet = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["include", "exclude"]) &&
  Object.keys(value).length === 2 &&
  "include" in value &&
  "exclude" in value &&
  Array.isArray(value.include) &&
  value.include.length <= MAX_TEMPLATE_TERMS_PER_SIDE &&
  value.include.every(validTerm) &&
  Array.isArray(value.exclude) &&
  value.exclude.length <= MAX_TEMPLATE_TERMS_PER_SIDE &&
  value.exclude.every(validTerm);

/**
 * A rule somebody just built, before it is normalised.
 *
 * It may exclude things and it may name particular resources, neither of which a
 * stored default can carry. Both become one `set` term naming a bound row, which
 * is why the wire shape is wider than the stored one.
 */
const validChosenSet = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["include", "exclude"]) &&
  Object.keys(value).length === 2 &&
  Array.isArray(value.include) &&
  value.include.length <= MAX_TEMPLATE_TERMS_PER_SIDE &&
  value.include.every((term) => validTerm(term) || validSetTerm(term)) &&
  Array.isArray(value.exclude) &&
  value.exclude.length <= MAX_TEMPLATE_TERMS_PER_SIDE &&
  value.exclude.every((term) => validTerm(term) || validSetTerm(term));

export const variablesOf = (
  value: unknown,
  subject: string,
  chosen = false
): readonly TemplateVariable[] => {
  if (!Array.isArray(value)) throw new Error(`templates/${subject}: variables is a list`);
  if (value.length > MAX_TEMPLATE_VARIABLES) {
    throw new Error(
      `templates/${subject}: a template has at most ${MAX_TEMPLATE_VARIABLES} variables`
    );
  }
  const seen = new Set<string>();
  const declared = new Set<string>();
  for (const variable of value) {
    if (
      !isRecord(variable) ||
      !hasOnlyKeys(variable, ["name", "label", "description", "kind", "default"])
    ) {
      throw new Error(`templates/${subject}: a variable has only represented fields`);
    }
    if (variable.kind !== undefined && variable.kind !== "scope" && variable.kind !== "text") {
      throw new Error(`templates/${subject}: a variable is answered with a scope or with text`);
    }
    if (variable.kind === "text" && variable.default !== undefined) {
      throw new Error(`templates/${subject}: a text variable has no default scope`);
    }
    if (!validCanonicalText(variable.name, MAX_VARIABLE_NAME_LENGTH)) {
      throw new Error(`templates/${subject}: every variable has a name`);
    }
    if (!validCanonicalText(variable.label, MAX_VARIABLE_LABEL_LENGTH)) {
      throw new Error(`templates/${subject}: every variable has a label`);
    }
    if (
      variable.description !== undefined &&
      (!isText(variable.description) ||
        variable.description.length > MAX_VARIABLE_DESCRIPTION_LENGTH ||
        variable.description !== variable.description.trim())
    ) {
      throw new Error(`templates/${subject}: a variable description is text`);
    }
    if (
      variable.default !== undefined &&
      !(chosen ? validChosenSet(variable.default) : validTemplatedSet(variable.default))
    ) {
      throw new Error(`templates/${subject}: a variable default is a templated resource set`);
    }
    const key = variable.name.toLocaleLowerCase();
    if (seen.has(key)) throw new Error(`templates/${subject}: variable names are unique`);
    seen.add(key);
    declared.add(variable.name);
  }
  for (const variable of value as Fields[]) {
    if (!isRecord(variable.default)) continue;
    const terms = [
      ...((variable.default.include as unknown[]) ?? []),
      ...((variable.default.exclude as unknown[]) ?? [])
    ];
    for (const term of terms) {
      if (
        isRecord(term) &&
        term.select === "variable" &&
        !declared.has(term.name as string)
      ) {
        throw new Error(`templates/${subject}: a variable default names a declared variable`);
      }
    }
  }
  assertStoredValue(value, subject);
  return value as readonly TemplateVariable[];
};

export const has = (fields: Fields, field: string): boolean =>
  Object.prototype.hasOwnProperty.call(fields, field);

export const only = (fields: Fields, allowed: readonly string[], subject: string): void => {
  const extra = Object.keys(fields).filter((field) => !allowed.includes(field));
  if (extra.length > 0) {
    throw new Error(`templates/${subject}: unknown ${extra.length === 1 ? "field" : "fields"} ${extra.join(", ")}`);
  }
};

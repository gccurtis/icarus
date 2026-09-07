import type { DateValue, FormulaValue } from "$representation/data/types/content/formula-value";
import type { VariableValue } from "$representation/data/types/content/variable-value";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";
import { formatNumber } from "$app-views/categories/spreadsheet-editor/procedures/number-format";

export type { FormulaValue } from "$representation/data/types/content/formula-value";
export type { VariableValue } from "$representation/data/types/content/variable-value";
export type { SheetCell } from "$representation/data/types/spreadsheets/cell";

export const ERRORS: Readonly<Record<string, string>> = {
  "#REF!": "This formula refers to a range that no longer exists.",
  "#NAME?": "This formula names something nothing defines.",
  "#DIV/0!": "This formula divides by zero.",
  "#VALUE!": "This formula was given a value of the wrong kind.",
  "#N/A": "No value is available here.",
  "#NUM!": "This formula produced a number that cannot be represented.",
  "#NULL!": "This formula intersects two ranges that do not meet.",
  "#ERROR!": "This formula could not be read.",
  "#CYCLE!": "This formula depends on itself."
};

export const ERROR_NAMES: Readonly<Record<string, string>> = {
  "#REF!": "Broken reference",
  "#NAME?": "Unknown name",
  "#DIV/0!": "Division by zero",
  "#VALUE!": "Wrong kind of value",
  "#N/A": "Not available",
  "#NUM!": "Number out of range",
  "#NULL!": "Empty intersection",
  "#ERROR!": "Cannot be read",
  "#CYCLE!": "Depends on itself"
};

export const errorOf = (value: VariableValue | undefined): string | undefined =>
  value?.kind === "text" && value.value in ERRORS ? value.value : undefined;

export type ValueKind = "empty" | "text" | "number" | "logic" | "date" | "other";

export const kindOf = (value: VariableValue | undefined): ValueKind => {
  switch (value?.kind) {
    case undefined:
    case "empty":
      return "empty";
    case "text":
      return "text";
    case "number":
      return "number";
    case "logic":
      return "logic";
    case "date":
      return "date";
    default:
      return "other";
  }
};

export const KIND_LABEL: Readonly<Record<ValueKind, string>> = {
  empty: "empty",
  text: "text",
  number: "number",
  logic: "logic",
  date: "date",
  other: "structured"
};

export { formatNumber };

const two = (part: number): string => String(part).padStart(2, "0");

const dateText = (value: DateValue): string => {
  const day = `${value.year}-${two(value.month)}-${two(value.day)}`;
  return value.hour === undefined ? day : `${day} ${two(value.hour)}:${two(value.minute ?? 0)}`;
};

export const displayOf = (value: VariableValue | undefined, valueFormat?: string): string => {
  switch (value?.kind) {
    case undefined:
    case "empty":
      return "";
    case "number":
      return formatNumber(value.value, valueFormat);
    case "text":
      return value.value;
    case "logic":
      return value.value ? "TRUE" : "FALSE";
    case "date":
      return dateText(value.value);
    case "list":
      return value.values.map((held) => displayOf(held)).join(", ");
    case "record":
      return Object.entries(value.fields)
        .map(([name, held]) => `${name}: ${displayOf(held)}`)
        .join(", ");
    case "table":
      return `${value.rows.length} rows`;
    case "range":
      return "a range";
    case "function":
      return `function(${value.parameters.join(", ")})`;
    case "reference":
      return value.target.to === "variable" ? `→ ${value.target.name}` : "→ a resource";
  }
};

export const literalOf = (value: VariableValue | undefined): string => {
  switch (value?.kind) {
    case "number":
      return String(value.value);
    default:
      return displayOf(value);
  }
};

export const rawOf = (cell: SheetCell | undefined): string =>
  cell === undefined ? "" : (cell.expression ?? literalOf(cell.value));

export type Typed =
  | { readonly kind: "clear" }
  | { readonly kind: "expression"; readonly expression: string }
  | { readonly kind: "value"; readonly value: FormulaValue };

export const parseTyped = (text: string): Typed => {
  const trimmed = text.trim();
  if (trimmed === "") return { kind: "clear" };
  if (trimmed.startsWith("=") && trimmed.length > 1) {
    return { kind: "expression", expression: trimmed };
  }
  if (/^(true|false)$/i.test(trimmed)) {
    return { kind: "value", value: { kind: "logic", value: trimmed.toLowerCase() === "true" } };
  }
  const numeric = trimmed.replace(/^-\$/, "-").replace(/^\$/, "").replace(/,/g, "");
  if (/^-?\d+(\.\d+)?%?$/.test(numeric)) {
    const percent = numeric.endsWith("%");
    const parsed = Number(numeric.replace("%", ""));
    return { kind: "value", value: { kind: "number", value: percent ? parsed / 100 : parsed } };
  }
  return { kind: "value", value: { kind: "text", value: text } };
};

export const sameValue = (a: VariableValue | undefined, b: VariableValue | undefined): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

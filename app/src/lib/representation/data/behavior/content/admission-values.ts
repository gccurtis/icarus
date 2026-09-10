import {
  isStoredActor,
  isStoredChoice,
  isStoredRowId
} from "$representation/data/behavior/core/stored";
import { isResourceRef } from "$representation/data/behavior/core/resource";

export type Fields = Record<string, unknown>;

export const recordOf = (value: unknown): Fields | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Fields
    : undefined;

export const exact = (
  value: Fields,
  required: readonly string[],
  optional: readonly string[] = []
): boolean => {
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key));
};

export const text = (value: unknown, limit = 100_000): value is string =>
  typeof value === "string" && value.length <= limit;

export const canonical = (value: unknown, limit = 500): value is string =>
  text(value, limit) && value.length > 0 && value === value.trim();

export const identifier = (value: unknown): value is string =>
  canonical(value) && !/[.\s]/.test(value);

export const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const natural = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const bounded = (value: unknown, minimum: number, maximum: number): value is number =>
  finite(value) && value >= minimum && value <= maximum;

const boundedInteger = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) &&
  value >= minimum && value <= maximum;

export const currentActor = (value: unknown): boolean => isStoredActor(value);

export const currentResourceRef = isResourceRef;

export const currentFormulaValue = (value: unknown, depth = 0): boolean => {
  const held = recordOf(value);
  if (held === undefined || depth > 12) return false;
  if (held.kind === "empty") return exact(held, ["kind"]);
  if (held.kind === "number") return exact(held, ["kind", "value"]) && finite(held.value);
  if (held.kind === "text") return exact(held, ["kind", "value"]) && text(held.value);
  if (held.kind === "logic") {
    return exact(held, ["kind", "value"]) && typeof held.value === "boolean";
  }
  if (held.kind === "date") {
    if (!exact(held, ["kind", "value"])) return false;
    const date = recordOf(held.value);
    if (
      date === undefined ||
      !exact(
        date,
        ["calendar", "year", "month", "day", "utc"],
        ["hour", "minute", "second", "millisecond", "timeZone"]
      ) ||
      date.calendar !== "gregorian" ||
      !boundedInteger(date.year, -271_821, 275_760) ||
      !boundedInteger(date.month, 1, 12) ||
      !boundedInteger(date.day, 1, 31) ||
      !finite(date.utc)
    ) return false;
    return (date.hour === undefined || boundedInteger(date.hour, 0, 23)) &&
      (date.minute === undefined || boundedInteger(date.minute, 0, 59)) &&
      (date.second === undefined || boundedInteger(date.second, 0, 59)) &&
      (date.millisecond === undefined || boundedInteger(date.millisecond, 0, 999)) &&
      (date.timeZone === undefined || text(date.timeZone, 500));
  }
  if (held.kind === "list") {
    return exact(held, ["kind", "values"]) &&
      Array.isArray(held.values) &&
      held.values.length <= 10_000 &&
      held.values.every((entry) => currentFormulaValue(entry, depth + 1));
  }
  if (held.kind === "record") {
    const fields = recordOf(held.fields);
    return exact(held, ["kind", "fields"]) &&
      fields !== undefined &&
      Object.keys(fields).length <= 10_000 &&
      Object.values(fields).every((entry) => currentFormulaValue(entry, depth + 1));
  }
  if (held.kind === "table") {
    return exact(held, ["kind", "columns", "rows"]) &&
      Array.isArray(held.columns) &&
      held.columns.length <= 1_000 &&
      held.columns.every((entry) => {
        const column = recordOf(entry);
        return column !== undefined &&
          exact(column, [], ["name", "valueFormat"]) &&
          (column.name === undefined || text(column.name, 10_000)) &&
          (column.valueFormat === undefined || text(column.valueFormat, 10_000));
      }) &&
      Array.isArray(held.rows) &&
      held.rows.length <= 10_000 &&
      held.rows.every((row) =>
        Array.isArray(row) &&
        row.length <= 1_000 &&
        row.every((entry) => currentFormulaValue(entry, depth + 1))
      );
  }
  if (held.kind === "reference") {
    const target = recordOf(held.target);
    if (target === undefined || !exact(held, ["kind", "target"])) return false;
    if (target.to === "variable") {
      return exact(target, ["to", "name"]) && canonical(target.name, 160);
    }
    return target.to === "resource" &&
      exact(target, ["to", "ref"]) &&
      currentResourceRef(target.ref);
  }
  if (held.kind === "range") {
    const cell = (entry: unknown): boolean => {
      const ref = recordOf(entry);
      return ref !== undefined &&
        exact(ref, ["rowId", "columnId"]) &&
        identifier(ref.rowId) &&
        identifier(ref.columnId);
    };
    return exact(held, ["kind", "resourceId", "from", "to"]) &&
      isStoredRowId(held.resourceId, "spreadsheets") &&
      cell(held.from) &&
      cell(held.to);
  }
  return held.kind === "function" &&
    exact(held, ["kind", "parameters", "formulaId"]) &&
    Array.isArray(held.parameters) &&
    held.parameters.length <= 1_000 &&
    held.parameters.every((parameter) => canonical(parameter, 160)) &&
    isStoredRowId(held.formulaId, "formulas");
};

export const currentFormat = (value: unknown): boolean => {
  const format = recordOf(value);
  if (format === undefined || !exact(
    format,
    [],
    [
      "horizontalAlignment", "verticalAlignment", "fontFamily", "fontSize", "color",
      "lineHeight", "spaceBefore", "spaceAfter", "background", "border", "padding",
      "indent", "valueFormat"
    ]
  )) return false;
  if (
    format.horizontalAlignment !== undefined &&
    !isStoredChoice(format.horizontalAlignment, ["start", "center", "end", "justify"])
  ) return false;
  if (
    format.verticalAlignment !== undefined &&
    !isStoredChoice(format.verticalAlignment, ["top", "middle", "bottom"])
  ) return false;
  for (const field of ["fontSize", "lineHeight", "spaceBefore", "spaceAfter", "indent"] as const) {
    const held = format[field];
    if (held === undefined) continue;
    if (field === "fontSize" && !bounded(held, Number.MIN_VALUE, 1_000)) return false;
    if (field === "lineHeight" && !bounded(held, Number.MIN_VALUE, 100)) return false;
    if (
      field !== "fontSize" && field !== "lineHeight" &&
      !bounded(held, -10_000, 10_000)
    ) return false;
  }
  for (const field of ["fontFamily", "color", "background", "valueFormat"] as const) {
    if (format[field] !== undefined && !text(format[field], 10_000)) return false;
  }
  if (format.border !== undefined) {
    const border = recordOf(format.border);
    if (
      border === undefined ||
      !exact(border, ["color", "width", "style"]) ||
      !text(border.color, 10_000) ||
      !bounded(border.width, 0, 1_000) ||
      !isStoredChoice(border.style, ["solid", "dashed", "dotted"])
    ) return false;
  }
  if (format.padding !== undefined) {
    const padding = recordOf(format.padding);
    if (
      padding === undefined ||
      !exact(padding, [], ["x", "y"]) ||
      (padding.x !== undefined && !bounded(padding.x, 0, 10_000)) ||
      (padding.y !== undefined && !bounded(padding.y, 0, 10_000))
    ) return false;
  }
  return true;
};

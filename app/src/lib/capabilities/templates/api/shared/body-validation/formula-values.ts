import { isStoredRowId } from "$representation/data/behavior/core/stored";
import {
  MAX_TEMPLATE_COLUMNS,
  MAX_TEMPLATE_ROWS
} from "$capabilities/templates/api/shared/spreadsheet-address";
import {
  type Fields,
  MAX_BLOCK_TEXT_LENGTH,
  MAX_VALUE_DEPTH,
  hasOnlyKeys,
  isFiniteNumber,
  isRecord,
  isText,
  validCanonicalText,
  validIdentifier,
  validInteger,
  validText
} from "$capabilities/templates/api/shared/body-validation/primitives";

const validCellRef = (value: unknown): boolean =>
  isRecord(value) &&
  hasOnlyKeys(value, ["rowId", "columnId"]) &&
  Object.keys(value).length === 2 &&
  validIdentifier(value.rowId) &&
  validIdentifier(value.columnId);

export const validFormulaValue = (value: unknown, depth = 0): boolean => {
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

export const validVariableValue = (value: unknown): boolean => {
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

export const validMarkLink = (value: unknown): boolean => {
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

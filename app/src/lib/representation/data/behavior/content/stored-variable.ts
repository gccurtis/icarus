import { currentFormulaValue } from "$representation/data/behavior/content/admission";
import {
  hasExactFields,
  isStoredActor,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { VariableType } from "$representation/data/types/content/variable-value";
import type { TableRow } from "$representation/store/tables";

const VARIABLE_TYPES = [
  "any", "number", "text", "logic", "date", "list", "record", "table", "reference",
  "range", "function"
] as const satisfies readonly VariableType[];

/** One exact current variable row whose declared type can hold its represented value. */
export const isStoredVariable = (value: unknown): value is TableRow<"variables"> => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(
      row,
      ["_id", "_creationTime", "projectId", "name", "value", "type", "createdBy", "updatedAt"],
      ["description"]
    ) &&
    isStoredRowId(row._id, "variables") &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredText(row.name, 160) && row.name.length > 0 && row.name === row.name.trim() &&
    currentFormulaValue(row.value) &&
    (VARIABLE_TYPES as readonly unknown[]).includes(row.type) &&
    (row.type === "any" || storedFields(row.value)?.kind === row.type) &&
    (row.description === undefined || isStoredText(row.description, 10_000)) &&
    isStoredActor(row.createdBy) &&
    isStoredTime(row.updatedAt);
};

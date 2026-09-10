import {
  hasExactFields,
  isStoredIdentifier,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import { isResourceRef } from "$representation/data/behavior/core/resource";
import type { TableRow } from "$representation/store/tables";

/** One exact current formula owner; no unrecognized union fields are retained. */
export const isStoredFormulaUse = (value: unknown): boolean => {
  const use = storedFields(value);
  if (use === undefined) return false;
  if (use.in === "variable") {
    return hasExactFields(use, ["in", "name"]) && isStoredIdentifier(use.name);
  }
  return use.in === "resource" && hasExactFields(use, ["in", "ref", "path"]) &&
    isResourceRef(use.ref) && isStoredText(use.path, 10_000);
};

/** Exact current formula-row admission, including every nested use variant. */
export const isStoredFormula = (value: unknown): value is TableRow<"formulas"> => {
  const row = storedFields(value);
  return row !== undefined && hasExactFields(row, [
    "_id", "_creationTime", "projectId", "representation", "usedBy", "updatedAt"
  ]) && isStoredRowId(row._id, "formulas") && isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") && isStoredText(row.representation, 100_000) &&
    row.representation.length > 0 && Array.isArray(row.usedBy) &&
    row.usedBy.every(isStoredFormulaUse) && isStoredTime(row.updatedAt);
};

/** Exact current back-reference admission, including its discriminated target shape. */
export const isStoredDataBackReference = (
  value: unknown
): value is TableRow<"dataBackReferences"> => {
  const row = storedFields(value);
  if (row === undefined || !hasExactFields(
    row,
    ["_id", "_creationTime", "projectId", "formulaId", "targetKind", "target", "updatedAt"],
    ["to"]
  ) || !isStoredRowId(row._id, "dataBackReferences") || !isStoredTime(row._creationTime) ||
    !isStoredRowId(row.projectId, "projects") || !isStoredRowId(row.formulaId, "formulas") ||
    !isStoredText(row.target, 10_000) || row.target.length === 0 ||
    !isStoredTime(row.updatedAt)) return false;

  if (row.targetKind === "range") {
    return isStoredText(row.to, 10_000) && row.to.length > 0;
  }
  return (row.targetKind === "cell" || row.targetKind === "name") && row.to === undefined;
};

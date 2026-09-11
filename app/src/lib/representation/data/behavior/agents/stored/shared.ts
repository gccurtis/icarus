import { isToolId, orderedTools } from "$representation/data/behavior/agents/tools";
import { currentScope } from "$representation/data/behavior/content/admission-inline";
import { exact, recordOf, text } from "$representation/data/behavior/content/admission-values";
import {
  isStoredActor,
  isStoredNatural,
  isStoredRowId,
  isStoredTime
} from "$representation/data/behavior/core/stored";
import type { TableName } from "$representation/store/tables";

export type StoredFields = Record<string, unknown>;

export const nonemptyText = (value: unknown): value is string =>
  text(value) && value.length > 0;

export const currentResourceSet = (value: unknown): boolean => {
  if (!currentScope(value)) return false;
  const scope = recordOf(value);
  if (scope === undefined) return false;
  const terms = [...scope.include as unknown[], ...scope.exclude as unknown[]];
  return terms.every((term) => recordOf(term)?.select !== "slot");
};

export const storedTools = (value: unknown): boolean => {
  if (!Array.isArray(value) || !value.every((entry) => isToolId(entry))) return false;
  const ordered = orderedTools(value);
  return ordered.length === value.length &&
    ordered.every((entry, index) => entry === value[index]);
};

export const currentAgentRow = (
  value: unknown,
  table: TableName,
  required: readonly string[],
  optional: readonly string[] = []
): value is StoredFields => {
  const row = recordOf(value);
  return row !== undefined && exact(
    row,
    ["_id", "_creationTime", "projectId", "createdBy", "revision", "updatedAt", ...required],
    optional
  ) &&
    isStoredRowId(row._id, table) &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredActor(row.createdBy) &&
    isStoredNatural(row.revision) && row.revision >= 1 &&
    isStoredTime(row.updatedAt);
};

import type { Doc } from "$convex/_generated/dataModel";
import type { NameVariable, VariableValue } from "$name-manager/types/variable";

/**
 * The stored row as everything outside sees it.
 *
 * `projectId` stops here: a caller only ever receives variables from the project
 * it asked about, so repeating it per row says nothing — and a public type
 * carrying it invites a caller to read the project off a value instead of off
 * its own scope.
 *
 * `value` is asserted rather than inferred because the stored validator's leaves
 * are `v.any()`; the type is what stays truthful about the recursion.
 */
export const asVariable = (row: Doc<"nameVariables">): NameVariable => ({
  id: row._id,
  name: row.name,
  nameKey: row.nameKey,
  declaredType: row.declaredType,
  value: row.value as VariableValue,
  definitionOrder: row.definitionOrder,
  createdBy: row.createdBy,
  updatedAt: row.updatedAt
});

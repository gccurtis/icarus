import {
  readCurrentRows,
  type StoreUnitOfWork,
  type TableRow
} from "$model/server/store/index.server";
import { admittedResourceSetClaim } from "$representation/data/behavior/core/resource-set-rows";
import { sameResourceRef } from "$representation/data/behavior/core/resource";
import type { ResourceSet } from "$representation/data/types/core/resource-set";

type StoreReads = Pick<StoreUnitOfWork, "read">;

const resourceSetsIn = (store: StoreReads): readonly TableRow<"resourceSets">[] => {
  return readCurrentRows(store, "resourceSets");
};

/**
 * Expands a resource-owned scope row at the read boundary.
 *
 * Particular resources are normalized into a private `resourceSets` row so one
 * scope term can carry them through template substitution. That row is storage,
 * not a project-level set somebody chose. Editors therefore read the concrete
 * rule back, while named reusable sets remain named.
 */
export const visibleScopeOf = (
  store: StoreReads,
  output: TableRow<"derivedOutputs">
): ResourceSet | undefined => {
  const scope = output.scope;
  if (scope === undefined || scope.exclude.length > 0 || scope.include.length !== 1) {
    return scope;
  }

  const term = scope.include[0];
  if (term.select !== "set") return scope;

  const row = admittedResourceSetClaim(resourceSetsIn(store), term.setId);
  if (
    row === undefined ||
    row.projectId !== output.projectId ||
    row.name !== undefined ||
    row.boundTo.kind !== "resource"
  ) {
    return scope;
  }
  if (output.origin === undefined || !sameResourceRef(row.boundTo.ref, output.origin)) return scope;
  return row.set;
};

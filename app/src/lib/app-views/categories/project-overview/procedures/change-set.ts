import {
  readResourceSets,
  updateResourceSet,
  type ResourceSetItem
} from "$capabilities/resource-sets/index.remote";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export const changeSet = (view: WorkspaceStateModel, item: ResourceSetItem, set: ResourceSet) =>
  view.singleFlight(
    ["resource-set", view.project, item.id, "set", item.revision, JSON.stringify(set)],
    () =>
      updateResourceSet({ setId: item.id, baseRevision: item.revision, patch: { set } }).updates(
        readResourceSets
      )
  );

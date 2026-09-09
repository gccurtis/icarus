import {
  readResourceSets,
  removeResourceSet,
  type ResourceSetItem
} from "$capabilities/resource-sets/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export const removeSet = (view: WorkspaceStateModel, item: ResourceSetItem) =>
  view.singleFlight(["resource-set", view.project, item.id, "remove", item.revision], () =>
    removeResourceSet({ setId: item.id, baseRevision: item.revision }).updates(readResourceSets)
  );

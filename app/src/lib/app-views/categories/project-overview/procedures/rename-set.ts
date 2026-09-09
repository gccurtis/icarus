import {
  readResourceSets,
  updateResourceSet,
  type ResourceSetItem
} from "$capabilities/resource-sets/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export const renameSet = (view: WorkspaceStateModel, item: ResourceSetItem, name: string) =>
  view.singleFlight(["resource-set", view.project, item.id, "rename", item.revision, name.trim()], () =>
    updateResourceSet({
      setId: item.id,
      baseRevision: item.revision,
      patch: { name: name.trim() }
    }).updates(readResourceSets)
  );

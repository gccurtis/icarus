import {
  readResourceSets,
  updateResourceSet,
  type ResourceSetItem
} from "$capabilities/resource-sets/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export const describeSet = (
  view: WorkspaceStateModel,
  item: ResourceSetItem,
  description: string
) =>
  view.singleFlight(
    ["resource-set", view.project, item.id, "describe", item.revision, description.trim()],
    () =>
      updateResourceSet({
        setId: item.id,
        baseRevision: item.revision,
        patch: { description: description.trim() === "" ? null : description.trim() }
      }).updates(readResourceSets)
  );

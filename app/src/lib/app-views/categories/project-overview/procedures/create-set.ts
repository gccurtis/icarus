import {
  createResourceSet,
  readResourceSets
} from "$capabilities/resource-sets/index.remote";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export const createSet = (view: WorkspaceStateModel, name: string, set: ResourceSet) =>
  view.singleFlight(["resource-set", view.project, "create", name.trim(), JSON.stringify(set)], () =>
    createResourceSet({ name: name.trim(), set }).updates(readResourceSets)
  );

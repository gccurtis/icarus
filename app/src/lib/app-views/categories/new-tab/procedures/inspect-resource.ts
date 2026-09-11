import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { Resource } from "$app-views/categories/project-overview/procedures/resources";
import { inspectionFor } from "$app-views/categories/project-overview/procedures/inspecting";

export const inspectResource = (view: WorkspaceStateModel, row: Resource): void => {
  const { key, selection } = inspectionFor(row);
  view.inspect(key, selection);
};

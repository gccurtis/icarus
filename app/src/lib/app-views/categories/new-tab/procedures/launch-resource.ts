import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { Resource } from "$app-views/categories/project-overview/procedures/resources";
import { inspectResource } from "$app-views/categories/new-tab/procedures/inspect-resource";
import { openingFor } from "$app-views/categories/project-overview/procedures/opening";

export const launchResource = (view: WorkspaceStateModel, row: Resource): void => {
  const target = openingFor(row);
  if (target === undefined) {
    inspectResource(view, row);
    return;
  }
  view.open(target);
  if (row.kind === "file") view.inspect("external.file", { kind: "external-file", id: row.id });
};

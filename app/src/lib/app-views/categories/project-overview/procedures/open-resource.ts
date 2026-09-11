import { inspectionFor } from "$app-views/categories/project-overview/procedures/inspecting";
import { openingFor } from "$app-views/categories/project-overview/procedures/opening";
import type { Resource } from "$app-views/categories/project-overview/procedures/resources";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

/** Open a resource from the Overview while preserving its existing fallbacks. */
export const openResource = (view: WorkspaceStateModel, row: Resource): void => {
  const target = openingFor(row);
  if (target) {
    view.open(target);
    if (row.kind === "file") {
      view.inspect("external.file", { kind: "external-file", id: row.id });
    }
    return;
  }

  if (row.kind === "research" || row.kind === "analysis") {
    alert(`Opening "${row.name}" is not wired up yet.`);
    return;
  }
  const { key, selection } = inspectionFor(row);
  view.inspect(key, selection);
};

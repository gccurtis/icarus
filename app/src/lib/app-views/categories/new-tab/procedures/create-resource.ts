import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LauncherState } from "$app-views/categories/new-tab/content/launcher.state.svelte";
import type { CreateKind } from "$app-views/categories/new-tab/procedures/options";
import { createProjectResource } from "$app-views/categories/new-tab/procedures/creating";
import { openingFor } from "$app-views/categories/new-tab/procedures/opening";
import { createChat } from "$app-views/categories/project-overview/procedures/create-chat";

/** A late creation must not navigate a different tab or a remounted launcher. */
export const createResource = async (
  view: WorkspaceStateModel,
  state: LauncherState,
  kind: CreateKind
): Promise<void> => {
  if (state.pending !== undefined) return;
  if (kind === "analysis") {
    alert("Creating a represented analysis graph is not wired up yet.");
    return;
  }
  const originTabId = view.activeId;
  state.pending = kind;
  state.error = undefined;
  try {
    const resourceId = kind === "research"
      ? await view.singleFlight(["new-tab", view.project, "create", "research"], createChat)
      : (await createProjectResource(view, { target: kind })).resourceId;
    if (!state.mounted || view.activeId !== originTabId) return;
    const target = openingFor(kind, resourceId);
    if (target === undefined) throw new Error("This resource has no editor.");
    view.open(target);
  } catch (error) {
    if (state.mounted) state.error = error instanceof Error ? error.message : String(error);
  } finally {
    if (state.mounted) state.pending = undefined;
  }
};

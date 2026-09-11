import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LauncherState } from "$app-views/categories/new-tab/content/launcher.state.svelte";
import type { CreateKind } from "$app-views/categories/new-tab/procedures/options";
import { createProjectResource } from "$app-views/categories/new-tab/procedures/creating";
import { openingFor } from "$app-views/categories/new-tab/procedures/opening";
import { createChat } from "$app-views/categories/project-overview/procedures/create-chat";
import {
  LAUNCHER_BUSY,
  runLauncherCommand
} from "$app-views/categories/new-tab/procedures/run-launcher-command";

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
  const command = runLauncherCommand(view, originTabId, async () =>
    kind === "research"
      ? createChat()
      : (await createProjectResource(view, originTabId, { target: kind })).resourceId
  );
  if (command === undefined) {
    state.error = LAUNCHER_BUSY;
    return;
  }
  state.pending = kind;
  state.error = undefined;
  state.errorFocus = undefined;
  try {
    const resourceId = await command;
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

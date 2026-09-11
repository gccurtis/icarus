import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LauncherState } from "$app-views/categories/new-tab/content/launcher.state.svelte";
import type { LibraryTemplate } from "$app-views/categories/templates/procedures/library-types";
import { instantiateLauncherTemplate } from "$app-views/categories/new-tab/procedures/instantiate-template";
import { openingFor } from "$app-views/categories/new-tab/procedures/opening";
import {
  LAUNCHER_BUSY,
  runLauncherCommand
} from "$app-views/categories/new-tab/procedures/run-launcher-command";

/** Use saved template defaults and keep a refusal in the originating launcher. */
export const useTemplate = async (
  view: WorkspaceStateModel,
  state: LauncherState,
  row: LibraryTemplate
): Promise<void> => {
  if (state.pending !== undefined) return;
  if (row.makes === "Spreadsheet") {
    alert("Creating from a spreadsheet template is not wired up yet.");
    return;
  }
  const originTabId = view.activeId;
  const command = runLauncherCommand(
    view,
    originTabId,
    () => instantiateLauncherTemplate(row)
  );
  if (command === undefined) {
    state.error = LAUNCHER_BUSY;
    return;
  }
  state.pending = row.id;
  state.error = undefined;
  state.errorFocus = undefined;
  try {
    const result = await command;
    if (!state.mounted || view.activeId !== originTabId) return;
    if (!result.accepted) {
      state.error = result.detail;
      state.errorFocus = row.id;
      return;
    }
    const target = openingFor(result.target, result.resourceId);
    if (target === undefined) throw new Error("This template has no editor.");
    view.open(target);
  } catch (error) {
    if (state.mounted) {
      state.error = error instanceof Error ? error.message : String(error);
      state.errorFocus = row.id;
    }
  } finally {
    if (state.mounted) state.pending = undefined;
  }
};

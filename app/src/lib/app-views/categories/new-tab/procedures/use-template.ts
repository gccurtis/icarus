import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { LauncherState } from "$app-views/categories/new-tab/content/launcher.state.svelte";
import type { LibraryTemplate } from "$app-views/categories/templates/procedures/library-types";
import { instantiateTemplate } from "$app-views/categories/templates/procedures/instantiate-template";
import { openingFor } from "$app-views/categories/new-tab/procedures/opening";

/** Use saved template defaults and keep a refusal in the originating launcher. */
export const useTemplate = async (
  view: WorkspaceStateModel,
  state: LauncherState,
  row: LibraryTemplate
): Promise<void> => {
  if (state.pending !== undefined) return;
  const originTabId = view.activeId;
  state.pending = row.id;
  state.error = undefined;
  try {
    const result = await instantiateTemplate(view, row);
    if (!state.mounted || view.activeId !== originTabId) return;
    if (!result.accepted) {
      state.error = result.detail;
      return;
    }
    const target = openingFor(result.target, result.resourceId);
    if (target === undefined) throw new Error("This template has no editor.");
    view.open(target);
  } catch (error) {
    if (state.mounted) state.error = error instanceof Error ? error.message : String(error);
  } finally {
    if (state.mounted) state.pending = undefined;
  }
};

import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ExternalDirectoryInspectorState } from "$app-views/categories/external/inspector/directory.state.svelte";
import { inspectExternalDirectory } from "$app-views/categories/external/procedures/inspect-directory";
import type { LibraryExternalDirectory } from "$app-views/categories/external/procedures/library-query";
import { relocateExternalDirectory } from "$app-views/categories/external/procedures/move-directory";
import { cancelDirectoryEdit } from "$app-views/categories/external/procedures/directory-inspector/cancel-edit";

const destinationFor = (
  state: ExternalDirectoryInspectorState,
  held: LibraryExternalDirectory
): string => {
  const value = state.draft.trim();
  if (state.editing === "move") return value;
  return held.parentPath === "" || held.parentPath === null ? value : `${held.parentPath}/${value}`;
};

export const commitDirectoryEdit = async (
  state: ExternalDirectoryInspectorState,
  view: WorkspaceStateModel,
  directory: LibraryExternalDirectory | undefined
): Promise<void> => {
  const held = state.base;
  if (held === undefined || state.editing === undefined || state.pending) return;
  const destination = destinationFor(state, held);
  if (destination === "") {
    state.actionError = "A directory name or path is required.";
    return;
  }
  if (destination === held.relativePath) return cancelDirectoryEdit(state, directory);
  state.pending = true;
  state.actionError = undefined;
  try {
    const result = await relocateExternalDirectory(view, held, destination);
    if (!state.mounted) return;
    if (!result.accepted) state.actionError = result.detail;
    else {
      cancelDirectoryEdit(state, directory);
      inspectExternalDirectory(view, result.destinationDirectory);
    }
  } catch (error) {
    if (state.mounted) state.actionError = error instanceof Error ? error.message : String(error);
  } finally {
    state.pending = false;
  }
};

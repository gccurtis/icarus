import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";
import { renameExternalFile } from "$app-views/categories/external/procedures/rename-file";
import { cancelFileEdit } from "$app-views/categories/external/procedures/file-inspector/cancel-edit";
import { runFileInspectorCommand } from "$app-views/categories/external/procedures/file-inspector/run-command";

export const commitFileName = async (
  state: ExternalFileInspectorState,
  view: WorkspaceStateModel,
  file: LibraryExternalFileDetail | undefined
): Promise<void> => {
  const held = state.base;
  const name = state.nameDraft.trim();
  if (held === undefined || file?.id !== held.id || state.pending !== undefined) return;
  if (name === held.name) return cancelFileEdit(state, file);
  if (name === "") {
    state.actionError = "A file name is required.";
    return;
  }
  state.actionError = undefined;
  state.actionNotice = undefined;
  await runFileInspectorCommand(state, view, held.id, "rename", async () =>
    await renameExternalFile(view, held, name), (result) => {
    if (!result.accepted) state.actionError = result.detail;
    else {
      state.editingName = false;
      state.base = undefined;
      state.actionNotice = "File renamed.";
    }
  });
};

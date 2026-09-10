import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";
import { directoryOf } from "$app-views/categories/external/procedures/detail-query";
import { relocateExternalFile } from "$app-views/categories/external/procedures/move-file";
import { cancelFileEdit } from "$app-views/categories/external/procedures/file-inspector/cancel-edit";
import { runFileInspectorCommand } from "$app-views/categories/external/procedures/file-inspector/run-command";

export const commitFilePath = async (
  state: ExternalFileInspectorState,
  view: WorkspaceStateModel,
  file: LibraryExternalFileDetail | undefined
): Promise<void> => {
  const held = state.base;
  const destination = state.pathDraft.trim();
  if (held === undefined || file?.id !== held.id || state.pending !== undefined) return;
  if (destination === directoryOf(held.relativePath)) return cancelFileEdit(state, file);
  state.actionError = undefined;
  state.actionNotice = undefined;
  await runFileInspectorCommand(state, view, held.id, "move", async () =>
    await relocateExternalFile(view, held, destination), (result) => {
    if (!result.accepted) state.actionError = result.detail;
    else {
      state.editingPath = false;
      state.base = undefined;
      state.actionNotice = "File moved.";
    }
  });
};

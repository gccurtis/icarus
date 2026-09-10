import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";
import { updateExternalFileContext } from "$app-views/categories/external/procedures/update-context";
import { runFileInspectorCommand } from "$app-views/categories/external/procedures/file-inspector/run-command";

export const saveFileContext = async (
  state: ExternalFileInspectorState,
  view: WorkspaceStateModel,
  file: LibraryExternalFileDetail | undefined
): Promise<void> => {
  if (file === undefined || state.pending !== undefined) return;
  state.actionError = undefined;
  state.actionNotice = undefined;
  await runFileInspectorCommand(state, view, file.id, "context", async () =>
    await updateExternalFileContext(view, file, state.contextDraft), (result) => {
    if (!result.accepted) state.actionError = result.detail;
    else {
      state.actionNotice = result.semantic === "queued"
        ? "Dataset context saved and semantic processing queued."
        : "Dataset context saved.";
    }
  });
};

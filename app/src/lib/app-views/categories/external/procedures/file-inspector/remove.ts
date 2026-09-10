import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";
import { inspectExternalFile } from "$app-views/categories/external/procedures/inspect-file";
import { removeExternalFile } from "$app-views/categories/external/procedures/remove-file";
import { runFileInspectorCommand } from "$app-views/categories/external/procedures/file-inspector/run-command";

export const removeInspectedFile = async (
  state: ExternalFileInspectorState,
  view: WorkspaceStateModel,
  file: LibraryExternalFileDetail | undefined,
  nextId: string | undefined
): Promise<void> => {
  if (file === undefined || state.pending !== undefined) return;
  state.actionError = undefined;
  await runFileInspectorCommand(state, view, file.id, "delete", async () =>
    await removeExternalFile(view, file), (result) => {
    if (!result.accepted) {
      state.actionError = result.detail;
      state.confirmingDelete = false;
    } else if (nextId === undefined) {
      view.showContent("external.library");
    } else {
      inspectExternalFile(view, nextId);
    }
  });
};

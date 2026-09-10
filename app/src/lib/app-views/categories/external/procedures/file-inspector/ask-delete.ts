import type { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";
import { cancelFileEdit } from "$app-views/categories/external/procedures/file-inspector/cancel-edit";

export const askToDeleteFile = (
  state: ExternalFileInspectorState,
  file: LibraryExternalFileDetail | undefined
): void => {
  cancelFileEdit(state, file);
  state.confirmingDelete = true;
};

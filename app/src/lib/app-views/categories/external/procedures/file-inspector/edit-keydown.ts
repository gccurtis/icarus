import type { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";
import { cancelFileEdit } from "$app-views/categories/external/procedures/file-inspector/cancel-edit";

export const fileEditKeydown = (
  state: ExternalFileInspectorState,
  event: KeyboardEvent,
  commit: () => Promise<void>,
  file: LibraryExternalFileDetail | undefined
): void => {
  if (event.key === "Escape") {
    event.preventDefault();
    cancelFileEdit(state, file);
  } else if (event.key === "Enter") {
    event.preventDefault();
    void commit();
  }
};

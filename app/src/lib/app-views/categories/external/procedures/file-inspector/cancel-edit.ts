import { directoryOf } from "$app-views/categories/external/procedures/detail-query";
import type { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";

export const cancelFileEdit = (
  state: ExternalFileInspectorState,
  file: LibraryExternalFileDetail | undefined
): void => {
  state.nameDraft = file?.name ?? "";
  state.pathDraft = file === undefined ? "" : directoryOf(file.relativePath);
  state.base = undefined;
  state.editingName = false;
  state.editingPath = false;
};

import { directoryOf } from "$app-views/categories/external/procedures/detail-query";
import type { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";

export const resetFileInspector = (
  state: ExternalFileInspectorState,
  file: LibraryExternalFileDetail | undefined
): void => {
  state.activeId = file?.id;
  state.nameDraft = file?.name ?? "";
  state.pathDraft = file === undefined ? "" : directoryOf(file.relativePath);
  state.contextDraft = file?.semanticContext ?? "";
  state.base = undefined;
  state.editingName = false;
  state.editingPath = false;
  state.confirmingDelete = false;
  state.pending = undefined;
  state.activeCommand = undefined;
  state.actionError = undefined;
  state.actionNotice = undefined;
};

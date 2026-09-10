import { directoryOf } from "$app-views/categories/external/procedures/detail-query";
import type { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";

export const synchronizeFileInspector = (
  state: ExternalFileInspectorState,
  file: LibraryExternalFileDetail | undefined
): void => {
  if (file === undefined || state.editingName || state.editingPath || state.pending === "context") return;
  state.nameDraft = file.name;
  state.pathDraft = directoryOf(file.relativePath);
  state.contextDraft = file.semanticContext ?? "";
};

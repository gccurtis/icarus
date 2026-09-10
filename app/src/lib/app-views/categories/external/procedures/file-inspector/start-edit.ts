import { tick } from "svelte";

import type { ExternalFileInspectorState } from "$app-views/categories/external/inspector/file.state.svelte";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";
import { directoryOf } from "$app-views/categories/external/procedures/detail-query";
import { fileInspectorIsBusy } from "$app-views/categories/external/procedures/file-inspector/is-busy";

export const startFileEdit = async (
  state: ExternalFileInspectorState,
  file: LibraryExternalFileDetail | undefined,
  reuploadPending: number,
  kind: "name" | "path"
): Promise<void> => {
  if (file === undefined || fileInspectorIsBusy(state, reuploadPending)) return;
  state.base = file;
  state.confirmingDelete = false;
  if (kind === "name") {
    state.nameDraft = file.name;
    state.editingPath = false;
    state.editingName = true;
  } else {
    state.pathDraft = directoryOf(file.relativePath);
    state.editingName = false;
    state.editingPath = true;
  }
  await tick();
  const input = kind === "name" ? state.nameInput : state.pathInput;
  input?.focus();
  input?.select();
};

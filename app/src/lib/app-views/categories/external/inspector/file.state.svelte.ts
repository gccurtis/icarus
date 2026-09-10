import type { ReuploadExternalFileResult } from "$capabilities/external-files/index.remote";
import type { LibraryExternalFileDetail } from "$app-views/categories/external/procedures/library-query";

export type FileInspectorCommand = "rename" | "move" | "delete" | "context";

/** Mutable values owned by one mounted External file inspector. */
export class ExternalFileInspectorState {
  now = $state(Date.now());
  editingName = $state(false);
  editingPath = $state(false);
  nameDraft = $state("");
  pathDraft = $state("");
  contextDraft = $state("");
  nameInput = $state<HTMLInputElement | null>(null);
  pathInput = $state<HTMLInputElement | null>(null);
  base = $state<LibraryExternalFileDetail>();
  confirmingDelete = $state(false);
  pending = $state<FileInspectorCommand>();
  actionError = $state<string>();
  actionNotice = $state<string>();
  handledReupload = $state.raw<ReuploadExternalFileResult>();
  activeCommand = $state.raw<object>();
  activeId = $state<string>();
  mounted = true;
}

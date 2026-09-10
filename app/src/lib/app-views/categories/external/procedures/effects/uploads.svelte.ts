import type { UploadExternalFilesResult } from "$capabilities/external-files/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";
import { acceptUploadReceipt } from "$app-views/categories/external/procedures/accept-upload-receipt";
import { inspectExternalFile } from "$app-views/categories/external/procedures/inspect-file";

type Inputs = {
  readonly fileResult: () => UploadExternalFilesResult | undefined;
  readonly folderResult: () => UploadExternalFilesResult | undefined;
};

const selectFirstUpload = (
  state: ExternalLibraryState,
  view: WorkspaceStateModel,
  picker: "files" | "folder",
  result: UploadExternalFilesResult | undefined
): void => {
  if (result === undefined || !acceptUploadReceipt(state, picker, result)) return;
  const first = result.outcomes.find((outcome) => outcome.status !== "rejected");
  if (first !== undefined) inspectExternalFile(view, first.externalFileId);
};

export const keepExternalUploadsCurrent = (
  state: ExternalLibraryState,
  view: WorkspaceStateModel,
  input: Inputs
): void => {
  $effect(() => selectFirstUpload(state, view, "files", input.fileResult()));
  $effect(() => selectFirstUpload(state, view, "folder", input.folderResult()));
};

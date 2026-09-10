import type { UploadExternalFilesResult } from "$capabilities/external-files/index.remote";
import type { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";

export const acceptUploadReceipt = (
  state: ExternalLibraryState,
  picker: "files" | "folder",
  result: UploadExternalFilesResult
): boolean => {
  if (picker === "files") {
    if (state.handledFiles === result) return false;
    state.handledFiles = result;
    state.fileCount = 0;
    state.filePaths = [];
  } else {
    if (state.handledFolder === result) return false;
    state.handledFolder = result;
    state.folderCount = 0;
    state.folderPaths = [];
    state.folderPathError = undefined;
  }
  state.latestUploadResult = result;
  return true;
};

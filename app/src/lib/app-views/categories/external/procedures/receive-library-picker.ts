import type { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";

export const receiveLibraryPicker = (
  state: ExternalLibraryState,
  input: HTMLInputElement,
  picker: "files" | "folder",
  setRelativePaths: (paths: string[]) => void
): boolean => {
  const selected = Array.from(input.files ?? []);
  if (picker === "folder" && selected.some((file) => file.webkitRelativePath.length === 0)) {
    state.folderCount = 0;
    state.folderPaths = [];
    state.folderPathError = "The browser did not provide complete folder paths. Choose the folder again.";
    input.value = "";
    setRelativePaths([]);
    return false;
  }
  const paths = picker === "folder"
    ? selected.map((file) => file.webkitRelativePath)
    : selected.map((file) => file.name);
  state.folderPathError = undefined;
  setRelativePaths(paths);
  if (picker === "files") {
    state.fileCount = selected.length;
    state.filePaths = paths;
  } else {
    state.folderCount = selected.length;
    state.folderPaths = paths;
  }
  return selected.length > 0;
};

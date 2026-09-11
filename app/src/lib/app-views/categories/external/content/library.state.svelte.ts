import type { UploadExternalFilesResult } from "$capabilities/external-files/index.remote";

/** Mutable values owned by one mounted External library surface. */
export class ExternalLibraryState {
  now = $state(Date.now());
  fileInput = $state<HTMLInputElement | null>(null);
  folderInput = $state<HTMLInputElement | null>(null);
  fileCount = $state(0);
  folderCount = $state(0);
  filePaths = $state<string[]>([]);
  folderPaths = $state<string[]>([]);
  handledFiles = $state.raw<UploadExternalFilesResult>();
  handledFolder = $state.raw<UploadExternalFilesResult>();
  latestUploadResult = $state.raw<UploadExternalFilesResult>();
  folderPathError = $state<string>();
  mode = $state<"table" | "directory">("table");
  currentDirectory = $state("");
  search = $state("");
  kind = $state("all");
  author = $state("");
  semantic = $state("all");
  sortBy = $state("updated");
  direction = $state<"asc" | "desc">("asc");
}

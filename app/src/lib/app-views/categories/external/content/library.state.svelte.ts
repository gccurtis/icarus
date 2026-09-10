import type { UploadExternalFilesResult } from "$capabilities/external-files/index.remote";

/**
 * State owned by one mounted External library surface.
 *
 * Its filters, directory position, picker receipts, and relative-time clock die
 * with that surface. No value is shared across projects or remounts.
 */
export class ExternalLibraryState {
  now = $state(Date.now());
  fileCount = $state(0);
  folderCount = $state(0);
  filePaths = $state<string[]>([]);
  folderPaths = $state<string[]>([]);
  handledFiles = $state<string>();
  handledFolder = $state<string>();
  latestUploadResult = $state.raw<UploadExternalFilesResult>();

  mode = $state<"table" | "directory">("table");
  currentDirectory = $state("");
  search = $state("");
  kind = $state("all");
  semantic = $state("all");
  sortBy = $state("updated");
  direction = $state<"asc" | "desc">("asc");

  receive(
    input: HTMLInputElement,
    picker: "files" | "folder",
    setRelativePaths: (paths: string[]) => void
  ): void {
    const selected = Array.from(input.files ?? []);
    const paths = selected.map((file) => file.webkitRelativePath || file.name);
    setRelativePaths(paths);
    if (picker === "files") {
      this.fileCount = selected.length;
      this.filePaths = paths;
    } else {
      this.folderCount = selected.length;
      this.folderPaths = paths;
    }
  }

  acceptUpload(picker: "files" | "folder", result: UploadExternalFilesResult): boolean {
    const receipt = JSON.stringify(result);
    if (picker === "files") {
      if (this.handledFiles === receipt) return false;
      this.handledFiles = receipt;
      this.fileCount = 0;
      this.filePaths = [];
    } else {
      if (this.handledFolder === receipt) return false;
      this.handledFolder = receipt;
      this.folderCount = 0;
      this.folderPaths = [];
    }
    this.latestUploadResult = result;
    return true;
  }

  clearFilters(): void {
    this.search = "";
    this.kind = "all";
    this.semantic = "all";
  }
}

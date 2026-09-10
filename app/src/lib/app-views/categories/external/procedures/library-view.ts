import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";
import type {
  LibraryExternalDirectory,
  LibraryExternalFile
} from "$app-views/categories/external/procedures/library-query";

export const KIND_LABEL = {
  text: "Text",
  code: "Code",
  data: "Structured data",
  image: "Image",
  audio: "Audio",
  video: "Video",
  unknown: "Other"
} as const;

const matchesSemantic = (state: ExternalLibraryState, row: LibraryExternalFile): boolean => {
  if (state.semantic === "all") return true;
  if (state.semantic === "current") return row.semanticTone === "current";
  if (state.semantic === "queued") return row.semanticTone === "queued";
  if (state.semantic === "attention") return row.semanticTone === "failed";
  return row.semanticTone === "limited";
};

const compareFiles = (
  sortBy: string,
  left: LibraryExternalFile,
  right: LibraryExternalFile
): number => {
  if (sortBy === "name") return left.name.localeCompare(right.name);
  if (sortBy === "size") return left.size - right.size;
  if (sortBy === "kind") {
    return KIND_LABEL[left.subkind].localeCompare(KIND_LABEL[right.subkind]) ||
      left.name.localeCompare(right.name);
  }
  return right.updatedAt - left.updatedAt || left.name.localeCompare(right.name);
};

export const visibleExternalFiles = (
  state: ExternalLibraryState,
  files: readonly LibraryExternalFile[]
): readonly LibraryExternalFile[] => {
  const query = state.search.trim().toLocaleLowerCase();
  const filtered = files
    .filter((row) => state.kind === "all" || row.subkind === state.kind)
    .filter((row) => matchesSemantic(state, row))
    .filter((row) => query === "" ||
      `${row.name} ${row.originalName} ${row.relativePath} ${row.mediaType}`
        .toLocaleLowerCase().includes(query));
  const ordered = [...filtered].sort((left, right) => compareFiles(state.sortBy, left, right));
  if (state.direction === "desc") ordered.reverse();
  if (state.mode === "table") return ordered;
  return ordered.filter((row) => {
    const split = row.relativePath.lastIndexOf("/");
    return (split < 0 ? "" : row.relativePath.slice(0, split)) === state.currentDirectory;
  });
};

export const directExternalDirectories = (
  state: ExternalLibraryState,
  directories: readonly LibraryExternalDirectory[]
): readonly LibraryExternalDirectory[] => directories.filter((row) =>
  row.relativePath !== "" && row.parentPath === state.currentDirectory
);

export const libraryBreadcrumbs = (
  currentDirectory: string
): readonly { readonly label: string; readonly path: string }[] => {
  const segments = currentDirectory.split("/").filter(Boolean);
  return [
    { label: "External", path: "" },
    ...segments.map((label, index) => ({
      label,
      path: segments.slice(0, index + 1).join("/")
    }))
  ];
};

export const libraryFiltersActive = (state: ExternalLibraryState): boolean =>
  state.search.trim() !== "" || state.kind !== "all" || state.semantic !== "all";

export const externalFileIsSelected = (view: WorkspaceStateModel, id: string): boolean =>
  view.selection?.kind === "external-file" && view.selection.id === id;

export const externalDirectoryIsSelected = (view: WorkspaceStateModel, path: string): boolean =>
  view.selection?.kind === "external-directory" && view.selection.id === path;

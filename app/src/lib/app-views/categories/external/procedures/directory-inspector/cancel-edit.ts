import type { ExternalDirectoryInspectorState } from "$app-views/categories/external/inspector/directory.state.svelte";
import type { LibraryExternalDirectory } from "$app-views/categories/external/procedures/library-query";

export const cancelDirectoryEdit = (
  state: ExternalDirectoryInspectorState,
  directory: LibraryExternalDirectory | undefined
): void => {
  state.base = undefined;
  state.editing = undefined;
  state.draft = directory?.relativePath ?? "";
};

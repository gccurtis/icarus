import type { ExternalDirectoryInspectorState } from "$app-views/categories/external/inspector/directory.state.svelte";
import type { LibraryExternalDirectory } from "$app-views/categories/external/procedures/library-query";

export const synchronizeDirectoryInspector = (
  state: ExternalDirectoryInspectorState,
  directory: LibraryExternalDirectory | undefined
): void => {
  if (state.base?.relativePath === directory?.relativePath) return;
  state.base = undefined;
  state.editing = undefined;
  state.draft = directory?.relativePath ?? "";
  state.actionError = undefined;
};

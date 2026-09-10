import type { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";

export const setLibraryDirectory = (
  state: ExternalLibraryState,
  directory: string
): void => {
  state.currentDirectory = directory;
};

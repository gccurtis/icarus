import type { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";

export const setLibraryMode = (
  state: ExternalLibraryState,
  mode: ExternalLibraryState["mode"]
): void => {
  state.mode = mode;
};

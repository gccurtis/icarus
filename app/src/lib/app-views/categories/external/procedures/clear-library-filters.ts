import type { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";

export const clearLibraryFilters = (state: ExternalLibraryState): void => {
  state.search = "";
  state.kind = "all";
  state.author = "";
  state.semantic = "all";
};

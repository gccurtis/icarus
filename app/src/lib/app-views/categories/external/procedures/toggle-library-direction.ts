import type { ExternalLibraryState } from "$app-views/categories/external/content/library.state.svelte";

export const toggleLibraryDirection = (state: ExternalLibraryState): void => {
  state.direction = state.direction === "asc" ? "desc" : "asc";
};

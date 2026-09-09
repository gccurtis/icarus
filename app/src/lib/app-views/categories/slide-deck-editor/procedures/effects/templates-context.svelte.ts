import { onDestroy } from "svelte";

import type { TemplatesContextState } from "$app-views/categories/slide-deck-editor/context/templates.state.svelte";

/** Releases asynchronous panel commands with the component that owns them. */
export const releaseTemplatesContext = (state: TemplatesContextState): void => {
  onDestroy(() => state.dispose());
};

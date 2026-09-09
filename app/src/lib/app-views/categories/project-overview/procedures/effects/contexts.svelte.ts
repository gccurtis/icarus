import { onDestroy } from "svelte";

import type { ContextsState } from "$app-views/categories/project-overview/context/contexts.state.svelte";

export const releaseContexts = (state: ContextsState): void => {
  onDestroy(() => state.dispose());
};

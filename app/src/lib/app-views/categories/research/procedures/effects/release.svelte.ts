import { onDestroy } from "svelte";

import type { ThreadState } from "$app-views/categories/research/content/thread.state.svelte";

/** Hands the draft back to the workspace and stops late answers writing. */
export const releaseThread = (state: ThreadState): void => {
  onDestroy(() => state.dispose());
};

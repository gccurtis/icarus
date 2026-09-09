import { onDestroy } from "svelte";

import type { Working } from "$app-views/categories/agents/procedures/run";

/** Marks a surface gone, so a command that outlives it writes nothing back. */
export const releaseWhenGone = (state: Working): void => {
  onDestroy(() => {
    state.mounted = false;
  });
};

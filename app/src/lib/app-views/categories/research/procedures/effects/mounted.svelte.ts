import { onDestroy } from "svelte";

import type { Working } from "$app-views/categories/research/procedures/chat";

/** Marks a panel gone, so a command that outlives it writes nothing back. */
export const releaseWhenGone = (state: Working): void => {
  onDestroy(() => {
    state.mounted = false;
  });
};

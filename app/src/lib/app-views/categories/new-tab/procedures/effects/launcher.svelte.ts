import { onDestroy, onMount } from "svelte";
import type { LauncherState } from "$app-views/categories/new-tab/content/launcher.state.svelte";

export const keepLauncherCurrent = (state: LauncherState): void => {
  onDestroy(() => state.dispose());
  onMount(() => {
    const timer = setInterval(() => { state.now = Date.now(); }, 60_000);
    return () => clearInterval(timer);
  });
};

import { onDestroy, onMount } from "svelte";

import type { OverviewState } from "$app-views/categories/project-overview/content/overview.state.svelte";

class Clock {
  now = $state(Date.now());
}

/**
 * The board's own clock, and the moment it stops mattering.
 *
 * Every "2 hours ago" on this surface is drawn from one `now`, and a resource
 * created after the tab was left must not be opened over whatever the person is
 * looking at instead.
 */
export const keepBoardCurrent = (state: OverviewState, everyMs = 60_000): Clock => {
  const clock = new Clock();
  onDestroy(() => state.dispose());
  onMount(() => {
    const timer = setInterval(() => (clock.now = Date.now()), everyMs);
    return () => clearInterval(timer);
  });
  return clock;
};

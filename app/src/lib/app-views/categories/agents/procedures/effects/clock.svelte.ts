import { onMount } from "svelte";

class Clock {
  now = $state(Date.now());
}

/**
 * A `now` that advances while the surface is mounted.
 *
 * Every relative time and every elapsed duration in this category is drawn from
 * one of these. Without it a running task's "3 minutes" stays at three minutes
 * until something else happens to redraw the row.
 */
export const startClock = (everyMs = 30_000): Clock => {
  const clock = new Clock();
  onMount(() => {
    const timer = setInterval(() => (clock.now = Date.now()), everyMs);
    return () => clearInterval(timer);
  });
  return clock;
};

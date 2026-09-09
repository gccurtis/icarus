import { onMount } from "svelte";

class Clock {
  now = $state(Date.now());
}

/**
 * A `now` that advances while the surface is mounted.
 *
 * Every relative time on a research surface is drawn from one of these. Without
 * it "3 minutes ago" stays "3 minutes ago" until something else happens to
 * redraw the row, which on a quiet chat is never.
 */
export const startClock = (everyMs = 10_000): Clock => {
  const clock = new Clock();
  onMount(() => {
    const timer = setInterval(() => (clock.now = Date.now()), everyMs);
    return () => clearInterval(timer);
  });
  return clock;
};

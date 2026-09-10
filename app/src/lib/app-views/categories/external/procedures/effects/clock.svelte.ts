import { onMount } from "svelte";

class ExternalClock {
  now = $state(Date.now());
}

/** Relative-time clock whose lifetime is the component that asks for it. */
export const startExternalClock = (everyMs = 60_000): ExternalClock => {
  const clock = new ExternalClock();
  onMount(() => {
    const timer = setInterval(() => (clock.now = Date.now()), everyMs);
    return () => clearInterval(timer);
  });
  return clock;
};

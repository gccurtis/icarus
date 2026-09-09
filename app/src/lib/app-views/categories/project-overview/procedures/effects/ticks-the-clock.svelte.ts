import { onMount } from "svelte";

/** Keep relative timestamps fresh without giving each panel its own anonymous timer. */
export const ticksTheClock = (): { readonly current: number } => {
  let current = $state(Date.now());

  onMount(() => {
    const timer = setInterval(() => (current = Date.now()), 60_000);
    return () => clearInterval(timer);
  });

  return {
    get current(): number {
      return current;
    }
  };
};

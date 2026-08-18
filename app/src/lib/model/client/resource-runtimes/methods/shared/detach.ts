import type { ResourceRuntimesState, Runtime } from "$model/client/resource-runtimes/definition.svelte";
import type { RuntimeKey } from "$model/client/resource-runtimes/types";

/**
 * Moves one runtime out of `open` and into `settling`, and drops its
 * subscription.
 *
 * Shared because `release` and `releaseAll` must detach identically. The
 * ordering below is the invariant they share: the entry leaves `open` **before**
 * anything else happens, so a second release cannot find it and submit the same
 * buffer twice. Exactly-once falls out of the map rather than from a set of
 * things already released.
 *
 * The subscription goes here rather than at submit time because a detached
 * runtime must stop taking new bodies immediately — it is on its way out, and a
 * body arriving mid-flush would re-render a surface that is closing.
 *
 * Returns the runtime so the caller can settle it, or `undefined` when there was
 * nothing open under that key.
 */
export const detach = (state: ResourceRuntimesState, key: RuntimeKey): Runtime | undefined => {
  const runtime = state.open.get(key);
  if (!runtime) return undefined;

  state.open.delete(key);
  state.settling.set(key, runtime);

  runtime.clearTimer();
  runtime.unsubscribe?.();
  runtime.unsubscribe = undefined;

  return runtime;
};

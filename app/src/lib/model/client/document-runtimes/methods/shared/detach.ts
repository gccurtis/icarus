import type { DocumentRuntimesState, Runtime } from "$model/client/document-runtimes/definition.svelte";

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
 * runtime must stop taking new bodies immediately — a body arriving mid-flush
 * would re-render a surface that is closing.
 *
 * Returns the runtime so the caller can settle it, or `undefined` when there was
 * nothing open under that id.
 */
export const detach = (state: DocumentRuntimesState, id: string): Runtime | undefined => {
  const runtime = state.open.get(id);
  if (!runtime) return undefined;

  state.open.delete(id);
  state.settling.set(id, runtime);

  runtime.clearTimer();
  runtime.unsubscribe?.();
  runtime.unsubscribe = undefined;

  return runtime;
};

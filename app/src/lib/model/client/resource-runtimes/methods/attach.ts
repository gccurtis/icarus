import type { GeneralResourceType } from "$revisions/types/resource";
import type { ResourceRuntimesState, Runtime } from "$model/client/resource-runtimes/definition.svelte";
import { runtimeKey } from "$model/client/resource-runtimes/methods/shared/runtime-key";

/**
 * Open a resource, or hand back the one already open.
 *
 * **Idempotent, and that is the whole point.** The caller never has to know
 * whether it is the first viewer, which is what makes a second tab on one
 * document free — and what makes two tabs share one buffer rather than each
 * holding half the edits.
 *
 * A runtime found in `settling` is revived rather than duplicated. Reopening a
 * resource whose release has not finished submitting is ordinary — close a tab
 * and reopen it inside two seconds — and minting a second runtime there would
 * put two buffers on one resource at exactly the moment one of them is mid-flush.
 *
 * Synchronous. It returns with `sync: "loading"` and an undefined body, and the
 * body arrives reactively; awaiting would make opening a tab block on a round
 * trip.
 */
export const attach = (
  state: ResourceRuntimesState,
  type: GeneralResourceType,
  id: string
): Runtime => {
  const key = runtimeKey(type, id);

  const open = state.open.get(key);
  if (open) return open;

  const settling = state.settling.get(key);
  if (settling) {
    state.settling.delete(key);
    state.open.set(key, settling);
    subscribe(settling);
    return settling;
  }

  const runtime = state.createRuntime(type, id);
  state.open.set(key, runtime);
  subscribe(runtime);

  return runtime;
};

/**
 * The live read.
 *
 * ── FORWARD DECLARATION ──────────────────────────────────────────────────────
 * `revisions.read` does not exist: the capability ships its types today and its
 * tables later. The call below is the code we expect to run, and everything
 * around it is live — the runtime is genuinely subscribed-shaped, holds the
 * handle it will need to drop, and reports `loading` until a body lands.
 *
 * ```ts
 * const subscription = revisions.read({ resourceType: runtime.type, resourceId: runtime.id });
 * runtime.unsubscribe = subscription.onChange(({ body, revision }) => {
 *   runtime.body = body;
 *   runtime.revision = revision;
 *   if (runtime.sync === "loading") runtime.sync = "saved";
 * });
 * ```
 *
 * Until then a runtime stays in `loading` with no body, which is exactly what a
 * subscription that has not delivered yet looks like.
 */
const subscribe = (runtime: Runtime): void => {
  void runtime;
};

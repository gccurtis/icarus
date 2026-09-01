import type { DocumentRuntimesState, Runtime } from "$model/client/document-runtimes/definition.svelte";

/**
 * Open a document, or hand back the one already open.
 *
 * **Idempotent, and that is the whole point.** The caller never has to know
 * whether it is the first viewer, which is what makes a second tab on one
 * document free — and what makes two tabs share one buffer rather than each
 * holding half the edits.
 *
 * A runtime found in `settling` is revived rather than duplicated. Reopening a
 * document whose release has not finished submitting is ordinary — close a tab
 * and reopen it inside two seconds — and minting a second runtime there would
 * put two buffers on one document at exactly the moment one of them is mid-flush.
 *
 * Synchronous. It returns with `sync: "loading"` and an undefined body, and the
 * body arrives reactively; awaiting would make opening a tab block on a round
 * trip.
 */
export const attach = (state: DocumentRuntimesState, id: string): Runtime => {
  const open = state.open.get(id);
  if (open) return open;

  const settling = state.settling.get(id);
  if (settling) {
    state.settling.delete(id);
    state.open.set(id, settling);
    subscribe(settling);
    return settling;
  }

  const runtime = state.createRuntime(id);
  state.open.set(id, runtime);
  subscribe(runtime);

  return runtime;
};

/**
 * The live read.
 *
 * ── FORWARD DECLARATION ──────────────────────────────────────────────────────
 * Nothing serves a materialized document body yet: `documents` holds the body
 * and `documentSnapshots` anchors the replay that produces it, and neither is
 * readable from here. The call below is the code we expect to run, and
 * everything around it is live — the runtime is genuinely subscribed-shaped,
 * holds the handle it will need to drop, and reports `loading` until a body
 * lands.
 *
 * ```ts
 * const subscription = readDocument({ documentId: runtime.id });
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

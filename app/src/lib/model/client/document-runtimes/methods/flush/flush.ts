import type { Runtime } from "$model/client/document-runtimes/definition.svelte";
import { coalesce } from "$model/client/document-runtimes/methods/flush/coalesce";

/**
 * Submit everything buffered, as one change set.
 *
 * The only asynchronous thing in the object, and the only one a caller ever
 * needs to await: leaving the page, or a deliberate save. Nothing a user gesture
 * triggers waits on it — a slow or failed write becomes a status in the strip
 * rather than a spinner on a click.
 *
 * **Concurrent calls join the submit in flight rather than starting a second.**
 * Both thresholds can fire together, and `release` flushes a runtime that may
 * already be submitting. Two overlapping submits would each carry half the
 * buffer against one base revision, and the second would be refused for a
 * conflict it created itself.
 */
export const flush = (runtime: Runtime): Promise<void> => {
  runtime.pendingFlush ??= submit(runtime).finally(() => {
    runtime.pendingFlush = undefined;
    runtime.inFlight = false;
  });

  return runtime.pendingFlush;
};

/**
 * One submit.
 *
 * The buffer is taken *before* the call and cleared, so ops applied while it is
 * in flight accumulate for the next submit rather than being lost or sent twice.
 * A failure puts the taken ops back at the front — they happened first, and a
 * buffer that reordered them would submit a later edit as though it came
 * earlier.
 */
const submit = async (runtime: Runtime): Promise<void> => {
  runtime.clearTimer();
  if (runtime.buffer.length === 0) return;

  const ops = coalesce(runtime.buffer);
  runtime.buffer = [];

  runtime.inFlight = true;
  runtime.sync = "saving";

  try {
    // ── FORWARD DECLARATION ────────────────────────────────────────────────
    // Nothing writes `documentChangeSets` yet. This is the call we expect to
    // run:
    //
    // ```ts
    // const accepted = await submitDocumentChangeSet({
    //   documentId: runtime.id,
    //   baseRevision: runtime.revision,
    //   ops
    // });
    // runtime.revision = accepted.revision;
    // ```
    //
    // A refusal arrives carrying the server's revision and whether it is
    // retryable, and is handed to `rebase` — which is written and tested
    // directly, because nothing here can produce one yet.
    //
    // Until then the accepted branch is taken locally. Every state transition
    // below this line is the real one: the buffer is consumed, the revision
    // advances, and the strip reports what it will report then.
    const accepted = { revision: runtime.revision + 1 };
    runtime.revision = accepted.revision;

    // A flush that emptied the buffer is saved. One that did not — because ops
    // arrived while this was in flight — is still saving, and the next flush is
    // what will say otherwise rather than this one claiming a state it cannot
    // see.
    runtime.sync = runtime.buffer.length === 0 ? "saved" : "saving";
  } catch (error) {
    // The buffer is kept, never dropped. A runtime that could not send the
    // user's last edits is work disappearing, and there is no recovery from
    // discarding it quietly.
    runtime.buffer = [...ops, ...runtime.buffer];
    runtime.sync = "error";

    throw error;
  }
};

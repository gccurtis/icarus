import { submitSlideDeckChanges } from "$capabilities/slide-deck/index.remote";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import type { Runtime } from "$model/client/slide-deck-runtimes/definition.svelte";
import { coalesce } from "$model/client/slide-deck-runtimes/methods/flush/coalesce";
import { rebase } from "$model/client/slide-deck-runtimes/methods/flush/rebase";
import { sync } from "$model/client/slide-deck-runtimes/methods/sync";

export const flush = (runtime: Runtime): Promise<void> => {
  runtime.pendingFlush ??= submit(runtime).finally(() => {
    runtime.pendingFlush = undefined;
    runtime.inFlight = false;
  });

  return runtime.pendingFlush;
};

const changeSet = (runtime: Runtime, ops: readonly SlideDeckOp[]) => ({
  resourceId: runtime.id,
  baseRevision: runtime.revision,
  ops,
  touched: [...new Set(ops.map((op) => op.path))]
});

/**
 * A refusal the rebase could not resolve drops the change set and reads the body
 * back, so what is on screen is what the store holds. The runtime is a reader
 * again afterwards, not a casualty: there is nothing left for anyone to review.
 */
const revert = async (runtime: Runtime): Promise<void> => {
  runtime.buffer = [];
  runtime.inFlight = false;

  await sync(runtime);
};

const submit = async (runtime: Runtime): Promise<void> => {
  runtime.clearTimer();
  if (runtime.buffer.length === 0) return;

  const ops = coalesce(runtime.buffer);
  runtime.buffer = [];

  if (ops.length === 0) {
    runtime.sync = "saved";
    return;
  }

  runtime.inFlight = true;
  runtime.sync = "saving";

  try {
    const answer = await submitSlideDeckChanges({ changeSet: changeSet(runtime, ops) });

    if (answer.accepted) {
      runtime.inFlight = false;
      runtime.revision = answer.revision;
      runtime.sync = runtime.buffer.length === 0 ? "saved" : "saving";
      void sync(runtime);
      return;
    }

    // Only a stale change set is worth restating; anything else the body cannot
    // resolve, and re-sending it would be asking the same question twice.
    if (answer.reason !== "stale") {
      await revert(runtime);
      return;
    }

    rebase(runtime, ops, { revision: answer.revision, retryable: true });

    const restated = runtime.buffer;
    runtime.buffer = [];
    const retried = await submitSlideDeckChanges({ changeSet: changeSet(runtime, restated) });

    if (!retried.accepted) {
      await revert(runtime);
      return;
    }

    runtime.inFlight = false;
    runtime.revision = retried.revision;
    runtime.sync = runtime.buffer.length === 0 ? "saved" : "saving";
    void sync(runtime);
  } catch (error) {
    runtime.buffer = [...ops, ...runtime.buffer];
    runtime.sync = "error";

    throw error;
  }
};

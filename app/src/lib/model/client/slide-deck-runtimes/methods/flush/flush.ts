import { readSlideDeckBody, submitSlideDeckChanges } from "$capabilities/slide-deck/index.remote";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import type { Runtime } from "$model/client/slide-deck-runtimes/definition.svelte";
import { coalesce } from "$model/client/slide-deck-runtimes/methods/flush/coalesce";
import { emptyBody } from "$model/client/slide-deck-runtimes/methods/shared/empty-body";

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
 * A refused change set is dropped rather than replayed, and the body is read
 * back so what is on screen is what the store holds. An editor that kept ops the
 * server has refused would show a deck nobody else can see.
 */
const revert = async (runtime: Runtime): Promise<void> => {
  runtime.buffer = [];

  const found = await readSlideDeckBody({ resourceId: runtime.id });
  runtime.body = found === null ? emptyBody() : found.body;
  runtime.revision = found === null ? 0 : found.revision;
  runtime.sync = "needs-review";
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

    if (!answer.accepted) {
      await revert(runtime);
      return;
    }

    runtime.revision = answer.revision;
    runtime.sync = runtime.buffer.length === 0 ? "saved" : "saving";
  } catch (error) {
    runtime.buffer = [...ops, ...runtime.buffer];
    runtime.sync = "error";

    throw error;
  }
};

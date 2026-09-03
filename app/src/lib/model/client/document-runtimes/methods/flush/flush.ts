import { submitDocumentChanges } from "$capabilities/document/index.remote";
import type { DocumentOp } from "$representation/data/types/documents/op";
import type { Runtime } from "$model/client/document-runtimes/definition.svelte";
import { coalesce } from "$model/client/document-runtimes/methods/flush/coalesce";
import { rebase } from "$model/client/document-runtimes/methods/flush/rebase";
import { sync } from "$model/client/document-runtimes/methods/sync";

export const flush = (runtime: Runtime): Promise<void> => {
  runtime.pendingFlush ??= submit(runtime).finally(() => {
    runtime.pendingFlush = undefined;
    runtime.inFlight = false;
  });

  return runtime.pendingFlush;
};

const changeSet = (runtime: Runtime, ops: readonly DocumentOp[]) => ({
  resourceId: runtime.id,
  baseRevision: runtime.revision,
  ops,
  touched: [...new Set(ops.map((op) => op.path))]
});

/** The flight is over the moment an answer arrives, and `sync` only reads a settled runtime. */
const landed = (runtime: Runtime): void => {
  runtime.inFlight = false;
};

const revert = async (runtime: Runtime): Promise<void> => {
  landed(runtime);
  runtime.buffer = [];

  await sync(runtime);
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
    const answer = await submitDocumentChanges({ changeSet: changeSet(runtime, ops) });

    if (answer.accepted) {
      landed(runtime);
      runtime.revision = answer.revision;
      runtime.sync = runtime.buffer.length === 0 ? "saved" : "saving";
      void sync(runtime);
      return;
    }

    if (answer.reason !== "stale") {
      await revert(runtime);
      return;
    }

    rebase(runtime, ops, { revision: answer.revision, retryable: true });

    const restated = runtime.buffer;
    runtime.buffer = [];
    const retried = await submitDocumentChanges({ changeSet: changeSet(runtime, restated) });

    if (!retried.accepted) {
      await revert(runtime);
      return;
    }

    landed(runtime);
    runtime.revision = retried.revision;
    runtime.sync = runtime.buffer.length === 0 ? "saved" : "saving";
    void sync(runtime);
  } catch (error) {
    runtime.buffer = [...ops, ...runtime.buffer];
    runtime.sync = "error";

    throw error;
  }
};

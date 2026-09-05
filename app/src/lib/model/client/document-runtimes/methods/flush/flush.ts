import { submitDocumentChanges } from "$capabilities/document/index.remote";
import { applyOps } from "$representation/data/behavior/documents/apply-ops";
import type { DocumentOp } from "$representation/data/types/documents/op";
import type { Runtime } from "$model/client/document-runtimes/definition.svelte";
import { coalesce } from "$model/client/document-runtimes/methods/flush/coalesce";
import { rebase } from "$model/client/document-runtimes/methods/flush/rebase";
import { sync } from "$model/client/document-runtimes/methods/sync";

export const flush = (runtime: Runtime): Promise<void> => {
  if (runtime.failure !== undefined) return Promise.resolve();

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

const landed = (runtime: Runtime): void => {
  runtime.inFlight = false;
};

const caughtUp = (runtime: Runtime, ops: readonly DocumentOp[] | undefined): void => {
  const held = runtime.body;
  if (ops === undefined || ops.length === 0 || held === undefined) return;

  try {
    runtime.body = applyOps(held, ops);
  } catch {
    runtime.body = undefined;
  }
};

const accepted = (runtime: Runtime, revision: number, catchUp?: readonly DocumentOp[]): void => {
  landed(runtime);
  runtime.revision = revision;
  caughtUp(runtime, catchUp);
  runtime.sync = runtime.buffer.length === 0 ? "saved" : "saving";
  void sync(runtime);
};

const preserveFailure = (
  runtime: Runtime,
  ops: readonly DocumentOp[],
  refusal: { readonly reason: "stale" | "unresolved"; readonly detail: string }
): void => {
  landed(runtime);
  runtime.failure = { ...refusal, ops };
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
      accepted(runtime, answer.revision, answer.catchUp);
      return;
    }

    if (answer.reason !== "stale") {
      preserveFailure(runtime, ops, answer);
      return;
    }

    rebase(runtime, ops, { revision: answer.revision, retryable: true });

    const restated = runtime.buffer;
    runtime.buffer = [];
    const retried = await submitDocumentChanges({ changeSet: changeSet(runtime, restated) });

    if (!retried.accepted) {
      preserveFailure(runtime, restated, retried);
      return;
    }

    accepted(runtime, retried.revision, retried.catchUp);
  } catch (error) {
    runtime.buffer = [...ops, ...runtime.buffer];
    runtime.sync = "error";

    throw error;
  }
};

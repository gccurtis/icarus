import { submitSpreadsheetChanges } from "$capabilities/spreadsheet/index.remote";
import { applyOps } from "$representation/data/behavior/spreadsheets/apply-ops";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import type { Runtime } from "$model/client/spreadsheet-runtimes/definition.svelte";
import { coalesce } from "$model/client/spreadsheet-runtimes/methods/flush/coalesce";
import { rebase } from "$model/client/spreadsheet-runtimes/methods/flush/rebase";
import { sync } from "$model/client/spreadsheet-runtimes/methods/sync";

export const flush = (runtime: Runtime): Promise<void> => {
  runtime.pendingFlush ??= submit(runtime).finally(() => {
    runtime.pendingFlush = undefined;
    runtime.inFlight = false;
  });

  return runtime.pendingFlush;
};

const changeSet = (runtime: Runtime, ops: readonly SpreadsheetOp[]) => ({
  resourceId: runtime.id,
  baseRevision: runtime.revision,
  ops,
  touched: [...new Set(ops.map((op) => op.path))]
});

const landed = (runtime: Runtime): void => {
  runtime.inFlight = false;
};

const caughtUp = (runtime: Runtime, ops: readonly SpreadsheetOp[] | undefined): void => {
  const held = runtime.sheet;
  if (ops === undefined || ops.length === 0 || held === undefined) return;

  try {
    runtime.sheet = applyOps(held, ops);
  } catch {
    runtime.sheet = undefined;
  }
};

const accepted = (runtime: Runtime, revision: number, catchUp?: readonly SpreadsheetOp[]): void => {
  landed(runtime);
  runtime.revision = revision;
  caughtUp(runtime, catchUp);
  runtime.sync = runtime.buffer.length === 0 ? "saved" : "saving";
  void sync(runtime);
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
    const answer = await submitSpreadsheetChanges({ changeSet: changeSet(runtime, ops) });

    if (answer.accepted) {
      accepted(runtime, answer.revision, answer.catchUp);
      return;
    }

    if (answer.reason !== "stale") {
      await revert(runtime);
      return;
    }

    rebase(runtime, ops, { revision: answer.revision, retryable: true });

    const restated = runtime.buffer;
    runtime.buffer = [];
    const retried = await submitSpreadsheetChanges({ changeSet: changeSet(runtime, restated) });

    if (!retried.accepted) {
      await revert(runtime);
      return;
    }

    accepted(runtime, retried.revision, retried.catchUp);
  } catch (error) {
    runtime.buffer = [...ops, ...runtime.buffer];
    runtime.sync = "error";

    throw error;
  }
};

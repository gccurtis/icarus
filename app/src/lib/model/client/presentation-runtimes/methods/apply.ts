import { applyOps } from "$representation/data/behavior/presentations/apply-ops";
import type { PresentationOp } from "$representation/data/types/presentations/op";
import type { Runtime } from "$model/client/presentation-runtimes/definition.svelte";

/**
 * The working body moves before the ops are sent, so what the editor shows is
 * what it has asked for rather than what the store has already agreed to. A
 * refusal is what puts it back — `revert` re-reads and the optimism is undone.
 *
 * The body advances first: an op the applier will not take never reaches the
 * buffer, so a malformed gesture fails where it was made.
 */
export const buffer = (runtime: Runtime, ops: readonly PresentationOp[]): void => {
  const held = runtime.body;
  if (held !== undefined) runtime.body = applyOps(held, ops);

  runtime.buffer = [...runtime.buffer, ...ops];
  runtime.sync = "saving";
};

export const apply = (runtime: Runtime, ops: readonly PresentationOp[]): void => {
  if (ops.length === 0) return;

  buffer(runtime, ops);

  runtime.undoStack = [...runtime.undoStack, ops];
  runtime.redoStack = [];
};

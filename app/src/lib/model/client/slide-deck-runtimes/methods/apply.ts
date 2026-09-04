import { applyOps } from "$representation/data/behavior/slide-decks/apply-ops";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import type { Runtime } from "$model/client/slide-deck-runtimes/definition.svelte";

/**
 * The working body moves before the ops are sent, so what the editor shows is
 * what it has asked for rather than what the store has already agreed to. A
 * refusal is what puts it back — `revert` re-reads and the optimism is undone.
 *
 * The body advances first: an op the applier will not take never reaches the
 * buffer, so a malformed gesture fails where it was made.
 */
export const buffer = (runtime: Runtime, ops: readonly SlideDeckOp[]): void => {
  const held = runtime.body;
  if (held !== undefined) runtime.body = applyOps(held, ops);

  runtime.buffer = [...runtime.buffer, ...ops];
};

export const apply = (runtime: Runtime, ops: readonly SlideDeckOp[]): void => {
  if (ops.length === 0) return;

  buffer(runtime, ops);

  runtime.undoStack = [...runtime.undoStack, ops];
  runtime.redoStack = [];
};

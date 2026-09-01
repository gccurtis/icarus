import type { DocumentOp } from "$representation/data/types/revisions/document-op";
import type { Runtime } from "$model/client/document-runtimes/definition.svelte";

/**
 * Buffer ops without recording them.
 *
 * What undo and redo use: history has already accounted for those ops, and
 * recording them again would make an undo undoable — two undos in a row would
 * then flip between the same two states instead of walking back through the
 * history.
 *
 * The buffer is replaced rather than pushed into, because it is `$state.raw`:
 * assignment is what the projection reads.
 */
export const buffer = (runtime: Runtime, ops: readonly DocumentOp[]): void => {
  runtime.buffer = [...runtime.buffer, ...ops];
};

/**
 * Hand over what the user just did.
 *
 * **One history entry per call**, because one call is one gesture. That is what
 * makes an undo undo a gesture rather than a keystroke, and it is why coalescing
 * — which folds the buffer for the wire — must never touch these stacks.
 *
 * **The redo stack is cleared**, because a new edit makes the branch it led to
 * unreachable.
 *
 * **Then the ops are buffered.** Never awaited: a keystroke must not wait on
 * anything, so this returns immediately and the submit happens on a threshold.
 */
export const apply = (runtime: Runtime, ops: readonly DocumentOp[]): void => {
  if (ops.length === 0) return;

  runtime.undoStack = [...runtime.undoStack, ops];
  runtime.redoStack = [];

  buffer(runtime, ops);
};

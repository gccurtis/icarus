import type { DocumentOp } from "$representation/data/types/revisions/document-op";
import type { Runtime } from "$model/client/document-runtimes/definition.svelte";
import { invertAll } from "$model/client/document-runtimes/methods/history/invert";

/**
 * The undo and redo stacks: two lists of gestures, and the moves between them.
 *
 * Both hold what was **applied**, never what was inverted. Inverting on the way
 * out rather than on the way in is what lets one entry serve both directions —
 * an entry popped from `undo` goes onto `redo` unchanged, and the caller
 * receives the inverse to buffer.
 *
 * Neither function buffers anything. They return ops and the definition applies
 * them, which is what keeps a method from reaching for a sibling.
 */

/**
 * Move the last gesture from the undo stack to the redo stack, and return the
 * ops that reverse it.
 *
 * Empty when there is nothing to undo, which the caller reads as "do nothing"
 * rather than as an error — `canUndo` is the question, and a UI that asked it
 * first should not be the only thing standing between a keystroke and a throw.
 */
export const undo = (runtime: Runtime): readonly DocumentOp[] => {
  const entry = runtime.undoStack.at(-1);
  if (!entry) return [];

  runtime.undoStack = runtime.undoStack.slice(0, -1);
  runtime.redoStack = [...runtime.redoStack, entry];

  return invertAll(entry);
};

/**
 * Move the last undone gesture back, and return the ops that reapply it.
 *
 * The entry is returned as it was applied — a redo is the original gesture, not
 * an inversion of an inversion.
 */
export const redo = (runtime: Runtime): readonly DocumentOp[] => {
  const entry = runtime.redoStack.at(-1);
  if (!entry) return [];

  runtime.redoStack = runtime.redoStack.slice(0, -1);
  runtime.undoStack = [...runtime.undoStack, entry];

  return entry;
};

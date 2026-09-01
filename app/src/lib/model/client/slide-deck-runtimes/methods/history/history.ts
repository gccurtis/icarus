import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import type { Runtime } from "$model/client/slide-deck-runtimes/definition.svelte";
import { invertAll } from "$model/client/slide-deck-runtimes/methods/history/invert";

export const undo = (runtime: Runtime): readonly SlideDeckOp[] => {
  const entry = runtime.undoStack.at(-1);
  if (!entry) return [];

  runtime.undoStack = runtime.undoStack.slice(0, -1);
  runtime.redoStack = [...runtime.redoStack, entry];

  return invertAll(entry);
};

export const redo = (runtime: Runtime): readonly SlideDeckOp[] => {
  const entry = runtime.redoStack.at(-1);
  if (!entry) return [];

  runtime.redoStack = runtime.redoStack.slice(0, -1);
  runtime.undoStack = [...runtime.undoStack, entry];

  return entry;
};

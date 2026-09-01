import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import type { Runtime } from "$model/client/slide-deck-runtimes/definition.svelte";

export const buffer = (runtime: Runtime, ops: readonly SlideDeckOp[]): void => {
  runtime.buffer = [...runtime.buffer, ...ops];
};

export const apply = (runtime: Runtime, ops: readonly SlideDeckOp[]): void => {
  if (ops.length === 0) return;

  runtime.undoStack = [...runtime.undoStack, ops];
  runtime.redoStack = [];

  buffer(runtime, ops);
};

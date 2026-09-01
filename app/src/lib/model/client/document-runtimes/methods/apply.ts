import type { DocumentOp } from "$representation/data/types/documents/op";
import type { Runtime } from "$model/client/document-runtimes/definition.svelte";

export const buffer = (runtime: Runtime, ops: readonly DocumentOp[]): void => {
  runtime.buffer = [...runtime.buffer, ...ops];
};

export const apply = (runtime: Runtime, ops: readonly DocumentOp[]): void => {
  if (ops.length === 0) return;

  runtime.undoStack = [...runtime.undoStack, ops];
  runtime.redoStack = [];

  buffer(runtime, ops);
};

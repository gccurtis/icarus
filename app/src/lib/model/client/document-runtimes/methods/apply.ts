import { applyOps } from "$representation/data/behavior/documents/apply-ops";
import type { DocumentOp } from "$representation/data/types/documents/op";
import type { Runtime } from "$model/client/document-runtimes/definition.svelte";

export const buffer = (runtime: Runtime, ops: readonly DocumentOp[]): void => {
  const held = runtime.body;
  if (held !== undefined) runtime.body = applyOps(held, ops);

  runtime.buffer = [...runtime.buffer, ...ops];
};

export const apply = (runtime: Runtime, ops: readonly DocumentOp[]): void => {
  if (ops.length === 0) return;

  buffer(runtime, ops);

  runtime.undoStack = [...runtime.undoStack, ops];
  runtime.redoStack = [];
};

import type { SpreadsheetOp } from "$representation/data/types/revisions/spreadsheet-op";
import type { Runtime } from "$model/client/spreadsheet-runtimes/definition.svelte";

export const buffer = (runtime: Runtime, ops: readonly SpreadsheetOp[]): void => {
  runtime.buffer = [...runtime.buffer, ...ops];
};

export const apply = (runtime: Runtime, ops: readonly SpreadsheetOp[]): void => {
  if (ops.length === 0) return;

  runtime.undoStack = [...runtime.undoStack, ops];
  runtime.redoStack = [];

  buffer(runtime, ops);
};

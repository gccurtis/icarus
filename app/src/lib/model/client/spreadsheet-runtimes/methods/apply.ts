import { applyOps } from "$representation/data/behavior/spreadsheets/apply-ops";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import type { Runtime } from "$model/client/spreadsheet-runtimes/definition.svelte";

export const buffer = (runtime: Runtime, ops: readonly SpreadsheetOp[]): void => {
  const held = runtime.sheet;
  if (held !== undefined) runtime.sheet = applyOps(held, ops);

  runtime.buffer = [...runtime.buffer, ...ops];
};

export const apply = (runtime: Runtime, ops: readonly SpreadsheetOp[]): void => {
  if (ops.length === 0) return;

  buffer(runtime, ops);

  runtime.undoStack = [...runtime.undoStack, ops];
  runtime.redoStack = [];
};

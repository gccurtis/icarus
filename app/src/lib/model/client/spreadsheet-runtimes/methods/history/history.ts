import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import type { Runtime } from "$model/client/spreadsheet-runtimes/definition.svelte";
import { invertAll } from "$model/client/spreadsheet-runtimes/methods/history/invert";

export const undo = (runtime: Runtime): readonly SpreadsheetOp[] => {
  const entry = runtime.undoStack.at(-1);
  if (!entry) return [];

  runtime.undoStack = runtime.undoStack.slice(0, -1);
  runtime.redoStack = [...runtime.redoStack, entry];

  return invertAll(entry);
};

export const redo = (runtime: Runtime): readonly SpreadsheetOp[] => {
  const entry = runtime.redoStack.at(-1);
  if (!entry) return [];

  runtime.redoStack = runtime.redoStack.slice(0, -1);
  runtime.undoStack = [...runtime.undoStack, entry];

  return entry;
};

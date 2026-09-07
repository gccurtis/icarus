import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";

export type LiveSheet = {
  body: SpreadsheetBody;
  cells: Record<string, SheetCell>;
};

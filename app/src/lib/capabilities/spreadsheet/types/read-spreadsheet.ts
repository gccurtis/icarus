import type { SpreadsheetBody } from "$representation/data/types/spreadsheets/body";
import type { SheetCell } from "$representation/data/types/spreadsheets/cell";

export type ReadSpreadsheetInput = {
  readonly resourceId: string;
};

export type ReadSpreadsheetResult = {
  readonly revision: number;
  readonly body: SpreadsheetBody;
  readonly cells: readonly SheetCell[];
} | null;

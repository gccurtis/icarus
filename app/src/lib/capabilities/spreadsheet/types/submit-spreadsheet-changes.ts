import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";

export type SpreadsheetChangeSetInput = {
  readonly resourceId: string;
  readonly baseRevision: number;
  readonly ops: readonly SpreadsheetOp[];
  readonly touched: readonly string[];
};

export type SubmitSpreadsheetChangesInput = {
  readonly changeSet: SpreadsheetChangeSetInput;
};

export type SubmitRefusal = "stale" | "unresolved";

export type SubmitSpreadsheetChangesResult =
  | {
      readonly accepted: true;
      readonly revision: number;
      readonly catchUp?: readonly SpreadsheetOp[];
    }
  | {
      readonly accepted: false;
      readonly reason: SubmitRefusal;
      readonly revision: number;
      readonly detail: string;
    };

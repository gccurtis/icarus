import type { After } from "$representation/data/types/revisions/op";

/** Clearing a cell is a `set`; a `set` materializes the cell if it is not there. */
export type SpreadsheetOp =
  | { op: "set"; target: "cell" | "formatRule" | "mark"; path: string; value: unknown; was: unknown }
  | {
      op: "insert";
      target: "gridRow" | "gridColumn" | "formatRule";
      path: string;
      ids: string[];
      after: After;
      values: unknown[];
    }
  | {
      op: "remove";
      target: "gridRow" | "gridColumn" | "formatRule";
      path: string;
      ids: string[];
      after: After;
      values: unknown[];
    }
  | {
      op: "move";
      target: "gridRow" | "gridColumn";
      path: string;
      id: string;
      after: After;
      wasAfter: After;
    };

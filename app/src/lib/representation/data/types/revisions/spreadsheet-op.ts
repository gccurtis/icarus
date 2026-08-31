import type { After } from "$representation/data/types/revisions/op";

/**
 * Cells, the grid they sit in, and the rules formatting regions of it.
 *
 * `cell` takes no insert and no move: a cell has no ordinal position, and where
 * it sits is which row and column it names. `gridRow` and `gridColumn` are not
 * `row` — a document row and a spreadsheet row are different things.
 *
 * No `text` op. A cell holds a value and an expression rather than atoms, so
 * editing one is a `set`.
 */
export type SpreadsheetOp =
  | { op: "set"; target: "cell" | "formatRule" | "mark"; path: string; value: unknown; was: unknown }
  | {
      op: "insert";
      target: "gridRow" | "gridColumn" | "formatRule";
      path: string;
      after: After;
      values: unknown[];
    }
  | {
      op: "remove";
      target: "cell" | "gridRow" | "gridColumn" | "formatRule";
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

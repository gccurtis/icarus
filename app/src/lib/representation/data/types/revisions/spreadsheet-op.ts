import type { After } from "$representation/data/types/revisions/op";

/**
 * Cells, the grid they sit in, and the rules formatting regions of it.
 *
 * `cell` takes only `set`. A cell has no ordinal position — where it sits is
 * which row and column it names — so there is nowhere to insert one and nothing
 * to move it past, and clearing one is a `set` to nothing rather than a
 * `remove`. Applying a `set` materializes the cell if it is not there, which is
 * what makes setting a cleared cell back the whole of undoing the clear.
 *
 * `gridRow` and `gridColumn` are not `row` — a document row and a spreadsheet
 * row are different things.
 *
 * `insert` and `remove` therefore carry the same three ordinal targets, and an
 * `insert` names its `ids` so its inverse can remove exactly those.
 *
 * No `text` op. A cell holds a value and an expression rather than atoms.
 */
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

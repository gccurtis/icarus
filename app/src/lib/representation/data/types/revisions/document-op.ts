import type { After } from "$representation/data/types/revisions/op";

/**
 * What a document is made of: rows, the blocks in them, and the atoms and marks
 * in those.
 */
export type DocumentOp =
  | { op: "set"; target: "row" | "block" | "atom" | "mark"; path: string; value: unknown; was: unknown }
  | {
      op: "insert";
      target: "row" | "block" | "atom" | "mark";
      path: string;
      ids: string[];
      after: After;
      values: unknown[];
    }
  | {
      op: "remove";
      target: "row" | "block" | "atom" | "mark";
      path: string;
      ids: string[];
      after: After;
      values: unknown[];
    }
  | { op: "move"; target: "row" | "block"; path: string; id: string; after: After; wasAfter: After }
  /** Literal atoms only. A formula atom changes by `set`ting its expression. */
  | { op: "text"; target: "atom"; path: string; at: number; insert: string; remove: string };

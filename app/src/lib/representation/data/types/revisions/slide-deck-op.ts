import type { After } from "$representation/data/types/revisions/op";

/**
 * A deck is slides, the elements on them, and the sections that name runs of
 * slides. An element holds blocks, so it takes the content targets too.
 */
type DeckTarget = "slide" | "element" | "section" | "block" | "atom" | "mark";

export type SlideDeckOp =
  | { op: "set"; target: DeckTarget; path: string; value: unknown; was: unknown }
  | { op: "insert"; target: DeckTarget; path: string; ids: string[]; after: After; values: unknown[] }
  | {
      op: "remove";
      target: DeckTarget;
      path: string;
      ids: string[];
      after: After;
      values: unknown[];
    }
  | {
      op: "move";
      target: "slide" | "element" | "section" | "block";
      path: string;
      id: string;
      after: After;
      wasAfter: After;
    }
  /** Literal atoms only. A formula atom changes by `set`ting its expression. */
  | { op: "text"; target: "atom"; path: string; at: number; insert: string; remove: string };

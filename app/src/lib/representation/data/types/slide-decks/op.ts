type DeckTarget = "slide" | "element" | "section" | "block" | "atom" | "mark";

export type SlideDeckOp =
  | { op: "set"; target: DeckTarget; path: string; value: unknown; was: unknown }
  | {
      op: "insert";
      target: DeckTarget;
      path: string;
      ids: string[];
      after: string | null;
      values: unknown[];
    }
  | {
      op: "remove";
      target: DeckTarget;
      path: string;
      ids: string[];
      after: string | null;
      values: unknown[];
    }
  | {
      op: "move";
      target: "slide" | "element" | "section" | "block";
      path: string;
      id: string;
      after: string | null;
      wasAfter: string | null;
    }
  | { op: "text"; target: "atom"; path: string; at: number; insert: string; remove: string };

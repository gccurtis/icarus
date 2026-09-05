export type DocumentTarget = "row" | "block" | "atom" | "mark" | "document";

export type DocumentOp =
  | { op: "set"; target: DocumentTarget; path: string; value: unknown; was: unknown }
  | {
      op: "insert";
      target: DocumentTarget;
      path: string;
      ids: string[];
      after: string | null;
      values: unknown[];
    }
  | {
      op: "remove";
      target: DocumentTarget;
      path: string;
      ids: string[];
      after: string | null;
      values: unknown[];
    }
  | {
      op: "move";
      target: "row" | "block";
      path: string;
      id: string;
      after: string | null;
      wasAfter: string | null;
    }
  | { op: "text"; target: "atom"; path: string; at: number; insert: string; remove: string };

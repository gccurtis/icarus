export type DocumentOp =
  | { op: "set"; target: "row" | "block" | "atom" | "mark"; path: string; value: unknown; was: unknown }
  | {
      op: "insert";
      target: "row" | "block" | "atom" | "mark";
      path: string;
      ids: string[];
      after: string | null;
      values: unknown[];
    }
  | {
      op: "remove";
      target: "row" | "block" | "atom" | "mark";
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

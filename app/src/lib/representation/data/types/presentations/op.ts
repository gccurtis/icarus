type PresentationTarget = "slide" | "element" | "section" | "layout" | "block" | "atom" | "mark";

export type PresentationSetTarget = "presentation" | PresentationTarget;

export type PresentationOp =
  | { op: "set"; target: PresentationSetTarget; path: string; value: unknown; was: unknown }
  | {
      op: "insert";
      target: PresentationTarget;
      path: string;
      ids: string[];
      after: string | null;
      values: unknown[];
    }
  | {
      op: "remove";
      target: PresentationTarget;
      path: string;
      ids: string[];
      after: string | null;
      values: unknown[];
    }
  | {
      op: "move";
      target: "slide" | "element" | "section" | "layout" | "block";
      path: string;
      id: string;
      after: string | null;
      wasAfter: string | null;
    }
  | { op: "text"; target: "atom"; path: string; at: number; insert: string; remove: string };

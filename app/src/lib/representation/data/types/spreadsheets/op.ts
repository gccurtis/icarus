export type SpreadsheetOp =
  | { op: "set"; target: "cell" | "formatRule" | "mark"; path: string; value: unknown; was: unknown }
  | {
      op: "insert";
      target: "gridRow" | "gridColumn" | "formatRule";
      path: string;
      ids: string[];
      after: string | null;
      values: unknown[];
    }
  | {
      op: "remove";
      target: "gridRow" | "gridColumn" | "formatRule";
      path: string;
      ids: string[];
      after: string | null;
      values: unknown[];
    }
  | {
      op: "move";
      target: "gridRow" | "gridColumn";
      path: string;
      id: string;
      after: string | null;
      wasAfter: string | null;
    };

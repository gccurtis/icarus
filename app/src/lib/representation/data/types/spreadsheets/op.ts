export type SpreadsheetSetTarget = "cell" | "mark" | "formatRule" | "sheet";

export type SpreadsheetListTarget = "gridRow" | "gridColumn" | "formatRule" | "mark" | "sheet";

export type SpreadsheetOp =
  | { op: "set"; target: SpreadsheetSetTarget; path: string; value: unknown; was: unknown }
  | {
      op: "insert";
      target: SpreadsheetListTarget;
      path: string;
      ids: string[];
      after: string | null;
      values: unknown[];
    }
  | {
      op: "remove";
      target: SpreadsheetListTarget;
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

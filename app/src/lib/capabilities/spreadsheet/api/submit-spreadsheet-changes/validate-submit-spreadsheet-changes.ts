import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";
import type { SpreadsheetChangeSetInput } from "$capabilities/spreadsheet/types/submit-spreadsheet-changes";

const OPS = ["set", "insert", "remove", "move"];
const TARGETS = ["cell", "mark", "formatRule", "gridRow", "gridColumn", "sheet"];

const isOp = (value: unknown): value is SpreadsheetOp => {
  if (typeof value !== "object" || value === null) return false;

  const { op, target, path } = value as { op?: unknown; target?: unknown; path?: unknown };
  return (
    typeof op === "string" &&
    OPS.includes(op) &&
    typeof target === "string" &&
    TARGETS.includes(target) &&
    typeof path === "string" &&
    path.length > 0
  );
};

const same = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const validateSubmitSpreadsheetChanges = (input: unknown): SpreadsheetChangeSetInput => {
  if (typeof input !== "object" || input === null) {
    throw new Error("spreadsheet/submit-spreadsheet-changes: an object is required");
  }

  const { changeSet } = input as { changeSet?: unknown };
  if (typeof changeSet !== "object" || changeSet === null) {
    throw new Error("spreadsheet/submit-spreadsheet-changes: a changeSet is required");
  }

  const { resourceId, baseRevision, ops, touched } = changeSet as {
    resourceId?: unknown;
    baseRevision?: unknown;
    ops?: unknown;
    touched?: unknown;
  };

  if (typeof resourceId !== "string" || resourceId.length === 0) {
    throw new Error("spreadsheet/submit-spreadsheet-changes: resourceId is required");
  }
  if (typeof baseRevision !== "number" || !Number.isInteger(baseRevision) || baseRevision < 0) {
    throw new Error("spreadsheet/submit-spreadsheet-changes: baseRevision is a revision number");
  }
  if (!Array.isArray(ops) || ops.length === 0) {
    throw new Error("spreadsheet/submit-spreadsheet-changes: a change set carries at least one op");
  }
  if (!ops.every(isOp)) {
    throw new Error(
      "spreadsheet/submit-spreadsheet-changes: every op names an operation, a target and a path"
    );
  }
  if (!Array.isArray(touched) || !touched.every((path) => typeof path === "string")) {
    throw new Error("spreadsheet/submit-spreadsheet-changes: touched is the paths the ops reached");
  }
  if (!same(touched, [...new Set(ops.map((op) => op.path))])) {
    throw new Error(
      "spreadsheet/submit-spreadsheet-changes: touched disagrees with the ops, so neither can be trusted"
    );
  }

  return { resourceId, baseRevision, ops, touched };
};

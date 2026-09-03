import type { DocumentOp } from "$representation/data/types/documents/op";
import type { DocumentChangeSetInput } from "$capabilities/document/types/submit-document-changes";

const OPS = ["set", "insert", "remove", "move", "text"];
const TARGETS = ["row", "block", "atom", "mark"];

const isOp = (value: unknown): value is DocumentOp => {
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

/** Refuses anything the procedure could not act on. Throws; it never returns a partial. */
export const validateSubmitDocumentChanges = (input: unknown): DocumentChangeSetInput => {
  if (typeof input !== "object" || input === null) {
    throw new Error("document/submit-document-changes: an object is required");
  }

  const { changeSet } = input as { changeSet?: unknown };
  if (typeof changeSet !== "object" || changeSet === null) {
    throw new Error("document/submit-document-changes: a changeSet is required");
  }

  const { resourceId, baseRevision, ops, touched } = changeSet as {
    resourceId?: unknown;
    baseRevision?: unknown;
    ops?: unknown;
    touched?: unknown;
  };

  if (typeof resourceId !== "string" || resourceId.length === 0) {
    throw new Error("document/submit-document-changes: resourceId is required");
  }
  if (typeof baseRevision !== "number" || !Number.isInteger(baseRevision) || baseRevision < 0) {
    throw new Error("document/submit-document-changes: baseRevision is a revision number");
  }
  if (!Array.isArray(ops) || ops.length === 0) {
    throw new Error("document/submit-document-changes: a change set carries at least one op");
  }
  if (!ops.every(isOp)) {
    throw new Error(
      "document/submit-document-changes: every op names an operation, a target and a path"
    );
  }
  if (!Array.isArray(touched) || !touched.every((path) => typeof path === "string")) {
    throw new Error("document/submit-document-changes: touched is the paths the ops reached");
  }
  if (!same(touched, [...new Set(ops.map((op) => op.path))])) {
    throw new Error(
      "document/submit-document-changes: touched disagrees with the ops, so neither can be trusted"
    );
  }

  return { resourceId, baseRevision, ops, touched };
};

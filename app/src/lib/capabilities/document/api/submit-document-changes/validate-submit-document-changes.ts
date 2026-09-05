import type { DocumentOp } from "$representation/data/types/documents/op";
import type { DocumentChangeSetInput } from "$capabilities/document/types/submit-document-changes";

const OPS = ["set", "insert", "remove", "move", "text"];
const TARGETS = ["row", "block", "atom", "mark", "document"];

type Fields = Record<string, unknown>;

const has = (value: Fields, field: string): boolean => Object.hasOwn(value, field);
const id = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const nullableId = (value: unknown): value is string | null => value === null || id(value);
const ids = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every(id) && new Set(value).size === value.length;

const isOp = (value: unknown): value is DocumentOp => {
  if (typeof value !== "object" || value === null) return false;

  const fields = value as Fields;
  const { op, target, path } = fields;
  if (!(
    typeof op === "string" &&
    OPS.includes(op) &&
    typeof target === "string" &&
    TARGETS.includes(target) &&
    id(path)
  )) return false;

  if (op === "set") {
    return target !== "atom" && has(fields, "value") && has(fields, "was");
  }

  if (op === "insert" || op === "remove") {
    return (
      ids(fields.ids) &&
      Array.isArray(fields.values) &&
      fields.values.length === fields.ids.length &&
      nullableId(fields.after)
    );
  }

  if (op === "move") {
    return (
      (target === "row" || target === "block") &&
      id(fields.id) &&
      nullableId(fields.after) &&
      nullableId(fields.wasAfter) &&
      fields.after !== fields.id
    );
  }

  return (
    target === "atom" &&
    Number.isInteger(fields.at) &&
    Number(fields.at) >= 0 &&
    typeof fields.insert === "string" &&
    typeof fields.remove === "string" &&
    (fields.insert.length > 0 || fields.remove.length > 0)
  );
};

const same = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

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

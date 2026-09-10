import type { DocumentChangeSetInput } from "$capabilities/document/types/submit-document-changes";
import {
  hasExactFields,
  isStoredJson,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  storedFields
} from "$representation/data/behavior/core/stored";
import { isStoredDocumentOp } from "$representation/data/behavior/documents/stored-rows";

const matchingTouched = (ops: DocumentChangeSetInput["ops"], touched: readonly unknown[]):
  touched is readonly string[] => {
  if (!touched.every((path) => isStoredText(path, 10_000) && path.length > 0)) return false;
  const expected = [...new Set(ops.map((op) => op.path))];
  return touched.length === expected.length &&
    touched.every((path, index) => path === expected[index]);
};

/** Refuses any projection, legacy arm, or non-durable value before the command can run. */
export const validateSubmitDocumentChanges = (input: unknown): DocumentChangeSetInput => {
  const envelope = storedFields(input);
  if (envelope === undefined || !hasExactFields(envelope, ["changeSet"])) {
    throw new Error(
      "document/submit-document-changes: exactly one plain changeSet field is required"
    );
  }

  const changeSet = storedFields(envelope.changeSet);
  if (
    changeSet === undefined ||
    !hasExactFields(changeSet, ["resourceId", "baseRevision", "ops", "touched"])
  ) {
    throw new Error(
      "document/submit-document-changes: changeSet has exactly the current command fields"
    );
  }
  if (!isStoredRowId(changeSet.resourceId, "documents")) {
    throw new Error("document/submit-document-changes: resourceId is one current document id");
  }
  if (!isStoredNatural(changeSet.baseRevision)) {
    throw new Error("document/submit-document-changes: baseRevision is a revision number");
  }
  if (!Array.isArray(changeSet.ops) || changeSet.ops.length === 0) {
    throw new Error("document/submit-document-changes: at least one op is required");
  }
  if (!isStoredJson(changeSet.ops) || !changeSet.ops.every(isStoredDocumentOp)) {
    throw new Error(
      "document/submit-document-changes: every op names an operation, a target and a path " +
      "in exactly one current shape"
    );
  }
  if (
    !Array.isArray(changeSet.touched) ||
    !isStoredJson(changeSet.touched) ||
    !matchingTouched(changeSet.ops, changeSet.touched)
  ) {
    throw new Error(
      "document/submit-document-changes: touched disagrees with the ops; it must exactly name " +
      "each path in first-use order"
    );
  }

  return {
    resourceId: changeSet.resourceId,
    baseRevision: changeSet.baseRevision,
    ops: changeSet.ops,
    touched: changeSet.touched
  };
};

import type {
  PresentationChangeSetInput,
  SubmitPresentationChangesInput
} from "$capabilities/presentation/types/submit-presentation-changes";
import {
  hasExactFields,
  isStoredJson,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  storedFields
} from "$representation/data/behavior/core/stored";
import { isStoredPresentationOp } from "$representation/data/behavior/presentations/stored-rows";

const matchingTouched = (ops: PresentationChangeSetInput["ops"], touched: readonly unknown[]):
  touched is readonly string[] => {
  if (!touched.every((path) => isStoredText(path, 10_000) && path.length > 0)) return false;
  const expected = [...new Set(ops.map((op) => op.path))];
  return touched.length === expected.length &&
    touched.every((path, index) => path === expected[index]);
};

/** Refuses any projection, legacy arm, or non-durable value before the command can run. */
export const validateSubmitPresentationChanges = (input: unknown): SubmitPresentationChangesInput => {
  const envelope = storedFields(input);
  if (envelope === undefined || !hasExactFields(envelope, ["changeSet"])) {
    throw new Error(
      "presentation/submit-presentation-changes: exactly one plain changeSet field is required"
    );
  }

  const changeSet = storedFields(envelope.changeSet);
  if (
    changeSet === undefined ||
    !hasExactFields(changeSet, ["resourceId", "baseRevision", "ops", "touched"])
  ) {
    throw new Error(
      "presentation/submit-presentation-changes: changeSet has exactly the current command fields"
    );
  }
  if (!isStoredRowId(changeSet.resourceId, "presentations")) {
    throw new Error("presentation/submit-presentation-changes: resourceId is one current presentation id");
  }
  if (!isStoredNatural(changeSet.baseRevision)) {
    throw new Error("presentation/submit-presentation-changes: baseRevision is a revision number");
  }
  if (
    !Array.isArray(changeSet.ops) ||
    changeSet.ops.length === 0 ||
    !isStoredJson(changeSet.ops) ||
    !changeSet.ops.every(isStoredPresentationOp)
  ) {
    throw new Error(
      "presentation/submit-presentation-changes: every op has exactly one current operation shape"
    );
  }
  if (
    !Array.isArray(changeSet.touched) ||
    !isStoredJson(changeSet.touched) ||
    !matchingTouched(changeSet.ops, changeSet.touched)
  ) {
    throw new Error(
      "presentation/submit-presentation-changes: touched exactly names each op path in first-use order"
    );
  }

  const held: PresentationChangeSetInput = {
    resourceId: changeSet.resourceId,
    baseRevision: changeSet.baseRevision,
    ops: changeSet.ops,
    touched: changeSet.touched
  };
  return { changeSet: held };
};

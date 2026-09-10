import type {
  SlideDeckChangeSetInput,
  SubmitSlideDeckChangesInput
} from "$capabilities/slide-deck/types/submit-slide-deck-changes";
import {
  hasExactFields,
  isStoredJson,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  storedFields
} from "$representation/data/behavior/core/stored";
import { isStoredSlideDeckOp } from "$representation/data/behavior/slide-decks/stored-rows";

const matchingTouched = (ops: SlideDeckChangeSetInput["ops"], touched: readonly unknown[]):
  touched is readonly string[] => {
  if (!touched.every((path) => isStoredText(path, 10_000) && path.length > 0)) return false;
  const expected = [...new Set(ops.map((op) => op.path))];
  return touched.length === expected.length &&
    touched.every((path, index) => path === expected[index]);
};

/** Refuses any projection, legacy arm, or non-durable value before the command can run. */
export const validateSubmitSlideDeckChanges = (input: unknown): SubmitSlideDeckChangesInput => {
  const envelope = storedFields(input);
  if (envelope === undefined || !hasExactFields(envelope, ["changeSet"])) {
    throw new Error(
      "slide-deck/submit-slide-deck-changes: exactly one plain changeSet field is required"
    );
  }

  const changeSet = storedFields(envelope.changeSet);
  if (
    changeSet === undefined ||
    !hasExactFields(changeSet, ["resourceId", "baseRevision", "ops", "touched"])
  ) {
    throw new Error(
      "slide-deck/submit-slide-deck-changes: changeSet has exactly the current command fields"
    );
  }
  if (!isStoredRowId(changeSet.resourceId, "slideDecks")) {
    throw new Error("slide-deck/submit-slide-deck-changes: resourceId is one current slide deck id");
  }
  if (!isStoredNatural(changeSet.baseRevision)) {
    throw new Error("slide-deck/submit-slide-deck-changes: baseRevision is a revision number");
  }
  if (
    !Array.isArray(changeSet.ops) ||
    changeSet.ops.length === 0 ||
    !isStoredJson(changeSet.ops) ||
    !changeSet.ops.every(isStoredSlideDeckOp)
  ) {
    throw new Error(
      "slide-deck/submit-slide-deck-changes: every op has exactly one current operation shape"
    );
  }
  if (
    !Array.isArray(changeSet.touched) ||
    !isStoredJson(changeSet.touched) ||
    !matchingTouched(changeSet.ops, changeSet.touched)
  ) {
    throw new Error(
      "slide-deck/submit-slide-deck-changes: touched exactly names each op path in first-use order"
    );
  }

  const held: SlideDeckChangeSetInput = {
    resourceId: changeSet.resourceId,
    baseRevision: changeSet.baseRevision,
    ops: changeSet.ops,
    touched: changeSet.touched
  };
  return { changeSet: held };
};

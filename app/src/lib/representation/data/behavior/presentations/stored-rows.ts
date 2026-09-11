import {
  isStoredChangeSet,
  isStoredChangeSetOperation,
  type StoredChangeSetContract
} from "$representation/data/behavior/core/stored-change-set";
import { isStoredJson } from "$representation/data/behavior/core/stored";
import {
  isStoredEditableRow,
  isStoredSnapshotRow
} from "$representation/data/behavior/core/stored-editor-row";
import { isStoredPresentationBody } from "$representation/data/behavior/presentations/stored-body";
import type { PresentationOp } from "$representation/data/types/presentations/op";
import type { TableRow } from "$representation/store/tables";

const CHANGE_SET_CONTRACT = {
  table: "presentationChangeSets",
  resourceTable: "presentations",
  setTargets: ["presentation", "slide", "element", "section", "layout", "block", "atom", "mark"],
  listTargets: ["slide", "element", "section", "layout", "block", "atom", "mark"],
  moveTargets: ["slide", "element", "section", "layout", "block"],
  text: true
} as const satisfies StoredChangeSetContract;

export const isStoredPresentation = (value: unknown): value is TableRow<"presentations"> =>
  isStoredEditableRow(value, "presentations");

export const isStoredPresentationSnapshot = (
  value: unknown
): value is TableRow<"presentationSnapshots"> =>
  isStoredSnapshotRow(value, "presentationSnapshots", "presentations", isStoredPresentationBody);

/** Exact current operation accepted by both the capability and stored row. */
export const isStoredPresentationOp = (value: unknown): value is PresentationOp =>
  isStoredJson(value) &&
  isStoredChangeSetOperation(value, CHANGE_SET_CONTRACT) &&
  (!(typeof value === "object" && value !== null &&
    "op" in value && (value.op === "insert" || value.op === "remove")) ||
    (
      "ids" in value && Array.isArray(value.ids) && value.ids.length > 0 &&
      "values" in value && Array.isArray(value.values) && value.values.length === value.ids.length
    ));

export const isStoredPresentationChangeSet = (
  value: unknown
): value is TableRow<"presentationChangeSets"> =>
  isStoredChangeSet(value, CHANGE_SET_CONTRACT);

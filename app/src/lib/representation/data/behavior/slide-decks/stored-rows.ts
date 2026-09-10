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
import { isStoredSlideDeckBody } from "$representation/data/behavior/slide-decks/stored-body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";
import type { TableRow } from "$representation/store/tables";

const CHANGE_SET_CONTRACT = {
  table: "slideDeckChangeSets",
  resourceTable: "slideDecks",
  setTargets: ["deck", "slide", "element", "section", "layout", "block", "atom", "mark"],
  listTargets: ["slide", "element", "section", "layout", "block", "atom", "mark"],
  moveTargets: ["slide", "element", "section", "layout", "block"],
  text: true
} as const satisfies StoredChangeSetContract;

export const isStoredSlideDeck = (value: unknown): value is TableRow<"slideDecks"> =>
  isStoredEditableRow(value, "slideDecks");

export const isStoredSlideDeckSnapshot = (
  value: unknown
): value is TableRow<"slideDeckSnapshots"> =>
  isStoredSnapshotRow(value, "slideDeckSnapshots", "slideDecks", isStoredSlideDeckBody);

/** Exact current operation accepted by both the capability and stored row. */
export const isStoredSlideDeckOp = (value: unknown): value is SlideDeckOp =>
  isStoredJson(value) &&
  isStoredChangeSetOperation(value, CHANGE_SET_CONTRACT) &&
  (!(typeof value === "object" && value !== null &&
    "op" in value && (value.op === "insert" || value.op === "remove")) ||
    (
      "ids" in value && Array.isArray(value.ids) && value.ids.length > 0 &&
      "values" in value && Array.isArray(value.values) && value.values.length === value.ids.length
    ));

export const isStoredSlideDeckChangeSet = (
  value: unknown
): value is TableRow<"slideDeckChangeSets"> =>
  isStoredChangeSet(value, CHANGE_SET_CONTRACT);

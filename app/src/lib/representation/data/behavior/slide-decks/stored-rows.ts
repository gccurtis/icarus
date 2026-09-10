import { isStoredChangeSet } from "$representation/data/behavior/core/stored-change-set";
import {
  isStoredEditableRow,
  isStoredSnapshotRow
} from "$representation/data/behavior/core/stored-editor-row";
import { isStoredSlideDeckBody } from "$representation/data/behavior/slide-decks/stored-body";
import type { TableRow } from "$representation/store/tables";

export const isStoredSlideDeck = (value: unknown): value is TableRow<"slideDecks"> =>
  isStoredEditableRow(value, "slideDecks");

export const isStoredSlideDeckSnapshot = (
  value: unknown
): value is TableRow<"slideDeckSnapshots"> =>
  isStoredSnapshotRow(value, "slideDeckSnapshots", "slideDecks", isStoredSlideDeckBody);

export const isStoredSlideDeckChangeSet = (
  value: unknown
): value is TableRow<"slideDeckChangeSets"> =>
  isStoredChangeSet(value, {
    table: "slideDeckChangeSets",
    resourceTable: "slideDecks",
    setTargets: ["slide", "element", "section", "layout", "block", "atom", "mark"],
    listTargets: ["slide", "element", "section", "layout", "block", "atom", "mark"],
    moveTargets: ["slide", "element", "section", "layout", "block"],
    text: true,
    setTargetOptional: true
  });

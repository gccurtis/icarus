import { isStoredChangeSet } from "$representation/data/behavior/core/stored-change-set";
import {
  isStoredEditableRow,
  isStoredSnapshotRow
} from "$representation/data/behavior/core/stored-editor-row";
import { isStoredDocumentBody } from "$representation/data/behavior/documents/stored-body";
import type { TableRow } from "$representation/store/tables";

export const isStoredDocument = (value: unknown): value is TableRow<"documents"> =>
  isStoredEditableRow(value, "documents");

export const isStoredDocumentSnapshot = (
  value: unknown
): value is TableRow<"documentSnapshots"> =>
  isStoredSnapshotRow(value, "documentSnapshots", "documents", isStoredDocumentBody);

export const isStoredDocumentChangeSet = (
  value: unknown
): value is TableRow<"documentChangeSets"> =>
  isStoredChangeSet(value, {
    table: "documentChangeSets",
    resourceTable: "documents",
    setTargets: ["row", "block", "atom", "mark", "document"],
    listTargets: ["row", "block", "atom", "mark", "document"],
    moveTargets: ["row", "block"],
    text: true,
    setTargetOptional: false
  });

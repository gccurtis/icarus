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
import { isStoredDocumentBody } from "$representation/data/behavior/documents/stored-body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import type { TableRow } from "$representation/store/tables";

const CHANGE_SET_CONTRACT = {
  table: "documentChangeSets",
  resourceTable: "documents",
  setTargets: ["row", "block", "mark", "document"],
  listTargets: ["row", "block", "atom", "mark", "document"],
  moveTargets: ["row", "block"],
  text: true
} as const satisfies StoredChangeSetContract;

export const isStoredDocument = (value: unknown): value is TableRow<"documents"> =>
  isStoredEditableRow(value, "documents");

export const isStoredDocumentSnapshot = (
  value: unknown
): value is TableRow<"documentSnapshots"> =>
  isStoredSnapshotRow(value, "documentSnapshots", "documents", isStoredDocumentBody);

/** Exact current operation accepted by both the capability and stored row. */
export const isStoredDocumentOp = (value: unknown): value is DocumentOp =>
  isStoredJson(value) &&
  isStoredChangeSetOperation(value, CHANGE_SET_CONTRACT) &&
  (!(typeof value === "object" && value !== null &&
    "op" in value && (value.op === "insert" || value.op === "remove")) ||
    (
      "ids" in value && Array.isArray(value.ids) && value.ids.length > 0 &&
      "values" in value && Array.isArray(value.values) && value.values.length === value.ids.length
    ));

export const isStoredDocumentChangeSet = (
  value: unknown
): value is TableRow<"documentChangeSets"> =>
  isStoredChangeSet(value, CHANGE_SET_CONTRACT);

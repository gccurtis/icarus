import {
  hasExactFields,
  isStoredActor,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";

type ResourceTable = "documents" | "slideDecks" | "spreadsheets";
type SnapshotTable = "documentSnapshots" | "slideDeckSnapshots" | "spreadsheetSnapshots";

/** Exact current common row shared by the three authored editors. */
export const isStoredEditableRow = (value: unknown, table: ResourceTable): boolean => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(
      row,
      ["_id", "_creationTime", "projectId", "title", "createdBy", "updatedBy", "updatedAt"],
      ["summary"]
    ) &&
    isStoredRowId(row._id, table) &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredText(row.title, 10_000) && row.title.length > 0 &&
    (row.summary === undefined || isStoredText(row.summary, 20_000)) &&
    isStoredActor(row.createdBy) && isStoredActor(row.updatedBy) &&
    isStoredTime(row.updatedAt);
};

/** Exact current snapshot envelope; its owning domain supplies the body proof. */
export const isStoredSnapshotRow = (
  value: unknown,
  table: SnapshotTable,
  resourceTable: ResourceTable,
  body: (value: unknown) => boolean
): boolean => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(row, [
      "_id", "_creationTime", "projectId", "resourceId", "revision", "role", "part", "body", "at"
    ]) &&
    isStoredRowId(row._id, table) &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredRowId(row.resourceId, resourceTable) &&
    isStoredNatural(row.revision) &&
    (row.role === "base" || row.role === "leader" || row.role === "checkpoint") &&
    isStoredNatural(row.part) && body(row.body) && isStoredTime(row.at);
};

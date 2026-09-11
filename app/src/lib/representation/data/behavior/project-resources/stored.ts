import {
  admitContentBlocks,
  currentResourceRef
} from "$representation/data/behavior/content/admission";
import { isStoredResearchThread } from "$representation/data/behavior/investigation/stored-rows";
import { isStoredExternalFile } from "$representation/data/behavior/external/stored-row";
import {
  hasExactFields,
  isStoredActor,
  isStoredIdentifier,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields,
  type StoredFields
} from "$representation/data/behavior/core/stored";
import type { TableName, TableRow } from "$representation/store/tables";

export type StoredProjectResource =
  | { readonly table: "documents"; readonly row: TableRow<"documents"> }
  | { readonly table: "presentations"; readonly row: TableRow<"presentations"> }
  | { readonly table: "spreadsheets"; readonly row: TableRow<"spreadsheets"> }
  | { readonly table: "researchThreads"; readonly row: TableRow<"researchThreads"> }
  | { readonly table: "externalFiles"; readonly row: TableRow<"externalFiles"> }
  | { readonly table: "findings"; readonly row: TableRow<"findings"> };

const common = (row: StoredFields): boolean =>
  isStoredIdentifier(row._id) &&
  isStoredTime(row._creationTime) &&
  isStoredRowId(row.projectId, "projects") &&
  isStoredText(row.title, 10_000) &&
  row.title.length > 0 &&
  isStoredActor(row.createdBy) &&
  isStoredTime(row.updatedAt) &&
  (row.summary === undefined || isStoredText(row.summary, 1_000));

export const isStoredEditableResource = (
  value: unknown,
  table: "documents" | "presentations" | "spreadsheets"
): value is TableRow<typeof table> => {
  const row = storedFields(value);
  return row !== undefined &&
    isStoredRowId(row._id, table) &&
    hasExactFields(
      row,
      ["_id", "_creationTime", "projectId", "title", "createdBy", "updatedBy", "updatedAt"],
      ["summary"]
    ) &&
    common(row) &&
    isStoredActor(row.updatedBy);
};

export { isStoredResearchThread };

const uniqueRowIds = (value: unknown, table: TableName): boolean =>
  Array.isArray(value) &&
  value.every((id) => isStoredRowId(id, table)) &&
  new Set(value).size === value.length;

const currentFindingSource = (value: unknown): boolean => {
  const source = storedFields(value);
  if (source === undefined) return false;
  if (source.kind === "resource") {
    return hasExactFields(source, ["kind", "ref"], ["locator", "excerpt"]) &&
      currentResourceRef(source.ref) &&
      (source.locator === undefined || isStoredText(source.locator, 10_000)) &&
      (source.excerpt === undefined || isStoredText(source.excerpt));
  }
  if (source.kind === "url") {
    return hasExactFields(source, ["kind", "url", "capturedAt"], ["title", "excerpt"]) &&
      isStoredText(source.url, 10_000) &&
      (source.title === undefined || isStoredText(source.title, 10_000)) &&
      (source.excerpt === undefined || isStoredText(source.excerpt)) &&
      isStoredTime(source.capturedAt);
  }
  if (source.kind === "message") {
    return hasExactFields(source, ["kind", "threadId", "messageId"], ["excerpt"]) &&
      isStoredRowId(source.threadId, "threads") &&
      isStoredIdentifier(source.messageId) &&
      (source.excerpt === undefined || isStoredText(source.excerpt));
  }
  return source.kind === "manual" &&
    hasExactFields(source, ["kind", "note"]) &&
    isStoredText(source.note);
};

export const isStoredFinding = (value: unknown): value is TableRow<"findings"> => {
  const row = storedFields(value);
  return row !== undefined &&
    isStoredRowId(row._id, "findings") &&
    hasExactFields(
      row,
      [
        "_id", "_creationTime", "projectId", "title", "body", "sources", "evidenceFor",
        "relatedTo", "researchThreadIds", "createdBy", "updatedBy", "revision", "updatedAt"
      ],
      ["summary"]
    ) &&
    common(row) &&
    admitContentBlocks(row.body) !== undefined &&
    Array.isArray(row.sources) &&
    row.sources.every(currentFindingSource) &&
    uniqueRowIds(row.evidenceFor, "hypotheses") &&
    uniqueRowIds(row.relatedTo, "questions") &&
    uniqueRowIds(row.researchThreadIds, "researchThreads") &&
    isStoredActor(row.updatedBy) &&
    isStoredNatural(row.revision) &&
    row.revision >= 1;
};

export const storedProjectResource = (
  value: unknown,
  table: TableName
): StoredProjectResource | undefined => {
  if (
    (table === "documents" || table === "presentations" || table === "spreadsheets") &&
    isStoredEditableResource(value, table)
  ) return { table, row: value } as StoredProjectResource;
  if (table === "researchThreads" && isStoredResearchThread(value)) {
    return { table, row: value };
  }
  if (table === "externalFiles" && isStoredExternalFile(value)) {
    return { table, row: value };
  }
  if (table === "findings" && isStoredFinding(value)) return { table, row: value };
  return undefined;
};

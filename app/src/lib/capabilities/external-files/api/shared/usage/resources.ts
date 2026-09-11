import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { Scope } from "$runtime/server/start.server";

import {
  documentBodyNamesExternalFile,
  resourceSetNamesExternalFile,
  sheetCellNamesExternalFile,
  presentationBodyNamesExternalFile
} from "$capabilities/external-files/api/shared/resource-references";
import { rowsOf } from "$capabilities/external-files/api/shared/rows";
import { representedName, usageItem } from "$capabilities/external-files/api/shared/usage/shared";
import type { ExternalFileUsageItem } from "$capabilities/external-files/types/read";

export const resourceUsage = (
  store: StoreUnitOfWork,
  scope: Scope,
  externalFileId: string
): readonly ExternalFileUsageItem[] => {
  const items: ExternalFileUsageItem[] = [];
  const inProject = <T extends { readonly projectId: string }>(row: T) =>
    row.projectId === scope.projectId;

  const documents = new Map(rowsOf(store, "documents").filter(inProject)
    .map((row) => [row._id, row.title]));
  for (const snapshot of rowsOf(store, "documentSnapshots")) {
    if (!inProject(snapshot) || snapshot.role !== "leader" ||
      !documentBodyNamesExternalFile(snapshot.body, externalFileId)) continue;
    items.push(usageItem(
      "document",
      snapshot.resourceId,
      representedName(documents, snapshot.resourceId, "document snapshot")
    ));
  }

  const presentations = new Map(rowsOf(store, "presentations").filter(inProject)
    .map((row) => [row._id, row.title]));
  for (const snapshot of rowsOf(store, "presentationSnapshots")) {
    if (!inProject(snapshot) || snapshot.role !== "leader" ||
      !presentationBodyNamesExternalFile(snapshot.body, externalFileId)) continue;
    items.push(usageItem(
      "presentation",
      snapshot.resourceId,
      representedName(presentations, snapshot.resourceId, "presentation snapshot")
    ));
  }

  const sheets = new Map(rowsOf(store, "spreadsheets").filter(inProject)
    .map((row) => [row._id, row.title]));
  for (const cell of rowsOf(store, "sheetCells")) {
    if (!inProject(cell) || !sheetCellNamesExternalFile(cell, externalFileId)) continue;
    items.push(usageItem(
      "spreadsheet",
      cell.resourceId,
      representedName(sheets, cell.resourceId, "spreadsheet cell")
    ));
  }

  for (const set of rowsOf(store, "resourceSets")) {
    if (inProject(set) && resourceSetNamesExternalFile(set.set, externalFileId)) {
      items.push(usageItem("resource-set", set._id, set.name ?? "Bound resource set"));
    }
  }
  return items;
};

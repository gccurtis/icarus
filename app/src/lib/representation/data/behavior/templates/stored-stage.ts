import {
  hasExactFields,
  isStoredActor,
  isStoredNatural,
  isStoredRowId,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { TableRow } from "$representation/store/tables";
import type { Id } from "$representation/data/types/core/id";

export type StoredTemplateStage = TableRow<"templateStages"> & (
  | { readonly target: "document"; readonly resourceId: Id<"documents"> }
  | { readonly target: "presentation"; readonly resourceId: Id<"presentations"> }
);

/** Exact current template-stage row and target/resource pairing. */
export const isStoredTemplateStage = (value: unknown): value is StoredTemplateStage => {
  const row = storedFields(value);
  if (
    row === undefined ||
    !hasExactFields(
      row,
      [
        "_id", "_creationTime", "projectId", "templateId", "templateRevision", "target",
        "resourceId", "createdBy", "updatedAt"
      ]
    ) ||
    !isStoredRowId(row._id, "templateStages") ||
    !isStoredTime(row._creationTime) ||
    !isStoredRowId(row.projectId, "projects") ||
    !isStoredRowId(row.templateId, "templates") ||
    !isStoredNatural(row.templateRevision) || row.templateRevision < 1 ||
    !isStoredActor(row.createdBy) ||
    !isStoredTime(row.updatedAt)
  ) return false;
  return row.target === "document"
    ? isStoredRowId(row.resourceId, "documents")
    : row.target === "presentation" && isStoredRowId(row.resourceId, "presentations");
};

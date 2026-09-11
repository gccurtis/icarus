import {
  hasExactFields,
  isStoredActor,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import { isStoredTemplateBody } from "$representation/data/behavior/templates/stored-body";
import {
  isStoredTemplateSlots,
  isStoredTemplateVersionSlots
} from "$representation/data/behavior/templates/stored-slots";
import type { TableRow } from "$representation/store/tables";

const positiveRevision = (value: unknown): value is number =>
  isStoredNatural(value) && value >= 1;

const canonicalText = (
  value: unknown,
  maximum: number,
  allowEmpty = false
): value is string =>
  isStoredText(value, maximum) &&
  (allowEmpty || value.length > 0) &&
  value === value.trim();

const tags = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.length <= 50 &&
  value.every((tag) => canonicalText(tag, 80)) &&
  new Set((value as string[]).map((tag) => tag.toLocaleLowerCase())).size === value.length;

/** One exact current live template row. */
export const isStoredTemplate = (value: unknown): value is TableRow<"templates"> => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(
      row,
      [
        "_id", "_creationTime", "projectId", "userId", "name", "tags", "body", "slots",
        "createdBy", "revision", "updatedAt"
      ],
      ["description", "lastUsedAt"]
    ) &&
    isStoredRowId(row._id, "templates") &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredRowId(row.userId, "users") &&
    canonicalText(row.name, 160) &&
    (row.description === undefined || canonicalText(row.description, 4_000, true)) &&
    tags(row.tags) &&
    isStoredTemplateBody(row.body) &&
    isStoredTemplateSlots(row.slots) &&
    isStoredActor(row.createdBy) &&
    positiveRevision(row.revision) &&
    isStoredTime(row.updatedAt) &&
    (row.lastUsedAt === undefined || isStoredTime(row.lastUsedAt));
};

/** One exact current immutable template-version row. */
export const isStoredTemplateVersion = (
  value: unknown
): value is TableRow<"templateVersions"> => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(
      row,
      ["_id", "_creationTime", "templateId", "revision", "name", "tags", "body", "slots", "at"],
      ["description"]
    ) &&
    isStoredRowId(row._id, "templateVersions") &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.templateId, "templates") &&
    positiveRevision(row.revision) &&
    canonicalText(row.name, 160) &&
    (row.description === undefined || canonicalText(row.description, 4_000, true)) &&
    tags(row.tags) &&
    isStoredTemplateBody(row.body) &&
    isStoredTemplateVersionSlots(row.slots) &&
    isStoredTime(row.at);
};

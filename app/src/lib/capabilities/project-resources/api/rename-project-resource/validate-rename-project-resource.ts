import {
  hasExactFields,
  isStoredRowId,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { RenameProjectResourceInput } from "$capabilities/project-resources/types/project-resources";

const fail = (reason: string): never => {
  throw new Error(`project-resources/rename-project-resource: ${reason}`);
};

export const validateRenameProjectResource = (input: unknown): RenameProjectResourceInput => {
  const fields = storedFields(input);
  if (fields === undefined || !hasExactFields(fields, ["resourceId", "title"])) {
    return fail("an exact current data object is required");
  }
  const { resourceId, title } = fields;
  if (
    !isStoredRowId(resourceId, "documents") &&
    !isStoredRowId(resourceId, "presentations") &&
    !isStoredRowId(resourceId, "spreadsheets")
  ) return fail("resourceId is one current editable resource id");
  if (typeof title !== "string" || title.trim().length === 0 || title.trim().length > 500) {
    return fail("title must be between 1 and 500 characters");
  }
  return { resourceId, title: title.trim() };
};

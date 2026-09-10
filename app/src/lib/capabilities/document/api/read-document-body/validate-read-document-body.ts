import type { ReadDocumentBodyInput } from "$capabilities/document/types/read-document-body";
import {
  hasExactFields,
  isStoredRowId,
  storedFields
} from "$representation/data/behavior/core/stored";

/** Refuses anything the procedure could not act on. Throws; it never returns a partial. */
export const validateReadDocumentBody = (input: unknown): ReadDocumentBodyInput => {
  const fields = storedFields(input);
  if (fields === undefined || !hasExactFields(fields, ["resourceId"])) {
    throw new Error("document/read-document-body: resourceId is required as the only plain field");
  }
  if (!isStoredRowId(fields.resourceId, "documents")) {
    throw new Error("document/read-document-body: resourceId is one current document id");
  }
  return { resourceId: fields.resourceId };
};

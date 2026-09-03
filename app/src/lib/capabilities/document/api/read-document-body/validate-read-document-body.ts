import type { ReadDocumentBodyInput } from "$capabilities/document/types/read-document-body";

/** Refuses anything the procedure could not act on. Throws; it never returns a partial. */
export const validateReadDocumentBody = (input: unknown): ReadDocumentBodyInput => {
  if (typeof input !== "object" || input === null) {
    throw new Error("document/read-document-body: an object is required");
  }

  const { resourceId } = input as { resourceId?: unknown };
  if (typeof resourceId !== "string" || resourceId.length === 0) {
    throw new Error("document/read-document-body: resourceId is required");
  }

  return { resourceId };
};

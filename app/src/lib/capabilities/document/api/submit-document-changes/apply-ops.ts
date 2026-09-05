import { applyOps as applyDocumentOps } from "$representation/data/behavior/documents/apply-ops";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";

export const applyOps = (body: DocumentBody, ops: readonly DocumentOp[]): DocumentBody => {
  try {
    return applyDocumentOps(body, ops);
  } catch (error) {
    throw new Error(
      `document/submit-document-changes ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

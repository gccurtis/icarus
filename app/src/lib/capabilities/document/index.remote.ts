import { command, query } from "$app/server";

import { readDocumentBody as readDocumentBodyProcedure } from "$capabilities/document/api/read-document-body/read-document-body";
import { submitDocumentChanges as submitDocumentChangesProcedure } from "$capabilities/document/api/submit-document-changes/submit-document-changes";

export const readDocumentBody = query("unchecked", readDocumentBodyProcedure);
export const submitDocumentChanges = command("unchecked", submitDocumentChangesProcedure);

export type {
  ReadDocumentBodyInput,
  ReadDocumentBodyResult
} from "$capabilities/document/types/read-document-body";
export type {
  SubmitDocumentChangesInput,
  SubmitDocumentChangesResult
} from "$capabilities/document/types/submit-document-changes";

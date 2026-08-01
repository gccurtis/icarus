import type { DocumentLifecycle, DocumentQuery, DocumentQueryRequest } from "../domain/model.js";
import {
  assertDocumentWireInput,
  DocumentWireError,
  exactKeys,
  requireNonNegativeInteger,
  requireRecord,
  requireString
} from "./operationSchemas.js";
import { requireEnum, requireIdentifier } from "./valueSchemas.js";

export const decodeDocumentQuery = (value: unknown): DocumentQueryRequest => {
  assertDocumentWireInput(value, "Document query request");
  const envelope = requireRecord(value, "Document query request");
  exactKeys(envelope, ["requestId", "query"], "Document query request");
  const requestId = requireIdentifier(envelope.requestId, "requestId");
  const raw = requireRecord(envelope.query, "query");
  const type = requireString(raw.type, "query.type") as DocumentQuery["type"];
  let query: DocumentQuery;
  switch (type) {
    case "document.list": {
      exactKeys(raw, ["type", "cursor", "lifecycle"], type);
      const lifecycle = raw.lifecycle === undefined
        ? undefined
        : requireEnum(raw.lifecycle, ["active", "archived", "trashed"], "lifecycle") as DocumentLifecycle;
      query = {
        type,
        ...(raw.cursor !== undefined ? { cursor: requireString(raw.cursor, "cursor") } : {}),
        ...(lifecycle ? { lifecycle } : {})
      };
      break;
    }
    case "document.load":
      exactKeys(raw, ["type", "documentId", "revision"], type);
      query = {
        type,
        documentId: requireIdentifier(raw.documentId, "documentId"),
        ...(raw.revision !== undefined ? { revision: requireNonNegativeInteger(raw.revision, "revision") } : {})
      };
      break;
    case "document.history":
      exactKeys(raw, ["type", "documentId", "cursor", "limit"], type);
      query = {
        type,
        documentId: requireIdentifier(raw.documentId, "documentId"),
        ...(raw.cursor !== undefined ? { cursor: requireString(raw.cursor, "cursor") } : {}),
        limit: requireNonNegativeInteger(raw.limit, "limit")
      };
      if (query.limit < 1 || query.limit > 1000) throw new DocumentWireError("history limit must be between 1 and 1000");
      break;
    case "document.attempt":
      exactKeys(raw, ["type", "documentId", "attemptId"], type);
      query = {
        type,
        documentId: requireIdentifier(raw.documentId, "documentId"),
        attemptId: requireIdentifier(raw.attemptId, "attemptId")
      };
      break;
    default:
      throw new DocumentWireError(`Unknown Document query: ${type}`);
  }
  return { requestId, query };
};

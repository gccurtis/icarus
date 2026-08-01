import type {
  SlideLifecycle,
  SlideQuery,
  SlideQueryRequest
} from "../domain/model.js";
import {
  assertSlideWireInput,
  exactKeys,
  requireNonNegativeInteger,
  requireRecord,
  requireString,
  SlideWireError
} from "./operationSchemas.js";
import { requireEnum, requireIdentifier } from "./valueSchemas.js";

export const decodeSlideQuery = (value: unknown): SlideQueryRequest => {
  assertSlideWireInput(value, "Slide query request");
  const envelope = requireRecord(value, "Slide query request");
  exactKeys(envelope, ["requestId", "query"], "Slide query request");
  const requestId = requireIdentifier(envelope.requestId, "requestId");
  const raw = requireRecord(envelope.query, "query");
  const type = requireString(raw.type, "query.type") as SlideQuery["type"];
  let query: SlideQuery;

  switch (type) {
    case "deck.list": {
      exactKeys(raw, ["type", "cursor", "lifecycle"], type);
      const lifecycle = raw.lifecycle === undefined
        ? undefined
        : requireEnum(
          raw.lifecycle,
          ["active", "archived", "trashed"],
          "lifecycle"
        ) as SlideLifecycle;
      query = {
        type,
        ...(raw.cursor !== undefined ? { cursor: requireString(raw.cursor, "cursor") } : {}),
        ...(lifecycle !== undefined ? { lifecycle } : {})
      };
      break;
    }
    case "deck.load":
      exactKeys(raw, ["type", "deckId", "revision"], type);
      query = {
        type,
        deckId: requireIdentifier(raw.deckId, "deckId"),
        ...(raw.revision !== undefined
          ? { revision: requireNonNegativeInteger(raw.revision, "revision") }
          : {})
      };
      break;
    case "deck.history":
      exactKeys(raw, ["type", "deckId", "cursor", "limit"], type);
      query = {
        type,
        deckId: requireIdentifier(raw.deckId, "deckId"),
        ...(raw.cursor !== undefined ? { cursor: requireString(raw.cursor, "cursor") } : {}),
        limit: requireNonNegativeInteger(raw.limit, "limit")
      };
      if (query.limit < 1 || query.limit > 1_000) {
        throw new SlideWireError("history limit must be between 1 and 1000");
      }
      break;
    case "deck.attempt":
      exactKeys(raw, ["type", "deckId", "attemptId"], type);
      query = {
        type,
        deckId: requireIdentifier(raw.deckId, "deckId"),
        attemptId: requireIdentifier(raw.attemptId, "attemptId")
      };
      break;
    default:
      throw new SlideWireError(`Unknown Slide query: ${type}`);
  }

  return { requestId, query };
};

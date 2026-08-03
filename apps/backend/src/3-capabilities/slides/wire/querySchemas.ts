import type { SlideQuery, SlideQueryRequest } from "../domain/model.js";
import {
  SLIDE_WIRE_LIMITS,
  SlideWireError,
  assertSlideWireInput,
  exactKeys,
  requireEnum,
  requireIdentifier,
  requirePositiveInteger,
  requireRecord,
  requireString
} from "./valueSchemas.js";

const QUERY_KEYS: Record<SlideQuery["type"], readonly string[]> = {
  "deck.list": ["type", "cursor", "lifecycle"],
  "deck.load": ["type", "deckId", "revision"],
  "deck.outline": ["type", "deckId", "revision"],
  "deck.history": ["type", "deckId", "cursor", "limit"],
  "deck.attempt": ["type", "deckId", "attemptId"]
};

/** Every query type the decoder accepts. Exported so a test can assert parity. */
export const SLIDE_QUERY_TYPES = Object.keys(QUERY_KEYS) as SlideQuery["type"][];

/** The Deck history page bound. Named rather than inlined, unlike Document's. */
export const MAX_HISTORY_LIMIT = 1_000;

const decodeQuery = (value: unknown): SlideQuery => {
  const raw = requireRecord(value, "query");
  const type = requireString(raw.type, "query.type") as SlideQuery["type"];
  const keys = QUERY_KEYS[type];
  if (!keys) throw new SlideWireError(`Unknown Slides query: ${type}`);
  exactKeys(raw, keys, type);

  switch (type) {
    case "deck.list":
      return {
        type,
        ...(raw.cursor !== undefined
          ? { cursor: requireString(raw.cursor, `${type}.cursor`) }
          : {}),
        ...(raw.lifecycle !== undefined
          ? {
              lifecycle: requireEnum(
                raw.lifecycle,
                ["active", "archived", "trashed"] as const,
                `${type}.lifecycle`
              )
            }
          : {})
      };
    case "deck.load":
    case "deck.outline":
      return {
        type,
        deckId: requireIdentifier(raw.deckId, `${type}.deckId`),
        // An absent revision means the head; a supplied one must be a real
        // revision, and revisions start at one.
        ...(raw.revision !== undefined
          ? { revision: requirePositiveInteger(raw.revision, `${type}.revision`) }
          : {})
      };
    case "deck.history": {
      const limit = requirePositiveInteger(raw.limit, `${type}.limit`);
      if (limit > MAX_HISTORY_LIMIT) {
        throw new SlideWireError(`${type}.limit exceeds the page limit`);
      }
      return {
        type,
        deckId: requireIdentifier(raw.deckId, `${type}.deckId`),
        ...(raw.cursor !== undefined
          ? { cursor: requireString(raw.cursor, `${type}.cursor`) }
          : {}),
        limit
      };
    }
    case "deck.attempt":
      return {
        type,
        deckId: requireIdentifier(raw.deckId, `${type}.deckId`),
        attemptId: requireIdentifier(raw.attemptId, `${type}.attemptId`)
      };
  }
};

export const decodeSlideQuery = (value: unknown): SlideQueryRequest => {
  assertSlideWireInput(value, "Slides query request");
  const raw = requireRecord(value, "Slides query request");
  exactKeys(raw, ["query"], "Slides query request");
  return { query: decodeQuery(raw.query) };
};

export { SLIDE_WIRE_LIMITS };

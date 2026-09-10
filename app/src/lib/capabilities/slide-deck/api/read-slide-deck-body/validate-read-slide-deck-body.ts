import type { ReadSlideDeckBodyInput } from "$capabilities/slide-deck/types/read-slide-deck-body";
import {
  hasExactFields,
  isStoredRowId,
  storedFields
} from "$representation/data/behavior/core/stored";

/** Refuses anything the procedure could not act on. Throws; it never returns a partial. */
export const validateReadSlideDeckBody = (input: unknown): ReadSlideDeckBodyInput => {
  const fields = storedFields(input);
  if (fields === undefined || !hasExactFields(fields, ["resourceId"])) {
    throw new Error("slide-deck/read-slide-deck-body: exactly one plain resourceId field is required");
  }
  if (!isStoredRowId(fields.resourceId, "slideDecks")) {
    throw new Error("slide-deck/read-slide-deck-body: resourceId is one current slide deck id");
  }
  return { resourceId: fields.resourceId };
};

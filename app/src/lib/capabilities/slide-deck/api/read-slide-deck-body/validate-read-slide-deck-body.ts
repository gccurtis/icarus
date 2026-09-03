import type { ReadSlideDeckBodyInput } from "$capabilities/slide-deck/types/read-slide-deck-body";

/** Refuses anything the procedure could not act on. Throws; it never returns a partial. */
export const validateReadSlideDeckBody = (input: unknown): ReadSlideDeckBodyInput => {
  if (typeof input !== "object" || input === null) {
    throw new Error("slide-deck/read-slide-deck-body: an object is required");
  }

  const { resourceId } = input as { resourceId?: unknown };
  if (typeof resourceId !== "string" || resourceId.length === 0) {
    throw new Error("slide-deck/read-slide-deck-body: resourceId is required");
  }

  return { resourceId };
};

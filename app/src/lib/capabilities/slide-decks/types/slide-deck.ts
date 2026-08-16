import type { Id } from "$convex/_generated/dataModel";
import type { Actor } from "$shared/types/actor";
import { SlideDecksError } from "$slide-decks/errors";

/** The two shapes a deck is drawn at. Fractional frames only agree if slides do. */
export type AspectRatio = "16:9" | "4:3";

/**
 * A deck as a gallery, a tab, or a search result sees it: everything but the
 * slides.
 *
 * `aspectRatio` is here because a thumbnail cannot be drawn without it and it is
 * on the row, unlike the theme — which is in the body, where an undo reaches it.
 */
export type SlideDeck = {
  readonly id: Id<"slideDecks">;
  readonly title: string;
  readonly aspectRatio: AspectRatio;
  /** What it was made from, if anything. Provenance; the copy is already full. */
  readonly templateId?: Id<"templates">;
  readonly createdBy: Actor;
  readonly updatedBy: Actor;
  readonly updatedAt: number;
};

/**
 * The stored form of a title: trimmed, and never empty.
 *
 * A deck is reached by name in every surface that lists one. What to call an
 * unnamed deck is the client's decision — refusing here is what stops the
 * capability inventing "Untitled" on its behalf.
 */
export const slideDeckTitle = (title: string): string => {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new SlideDecksError("empty-title", "A deck title cannot be empty");
  }
  return trimmed;
};

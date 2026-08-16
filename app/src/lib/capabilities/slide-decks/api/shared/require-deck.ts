import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { SlideDecksError } from "$slide-decks/errors";

/**
 * The deck that id names, or a refusal — and the two cases every function taking
 * a deck id starts with.
 *
 * **Not found, never forbidden.** A deck in another project answers exactly as
 * one that never existed. The gate proved the caller holds *a* project; this is
 * what proves the row is in it.
 */
export const requireDeck = async (
  ctx: QueryCtx,
  scope: Scope,
  id: Id<"slideDecks">
): Promise<Doc<"slideDecks">> => {
  const deck = await ctx.db.get(id);
  if (!deck || deck.projectId !== scope.projectId) {
    throw new SlideDecksError("not-found", `Deck not found: ${id}`);
  }
  return deck;
};

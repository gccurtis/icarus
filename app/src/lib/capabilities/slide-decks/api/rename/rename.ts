import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import type { Actor } from "$shared/types/actor";
import { requireDeck } from "$slide-decks/api/shared/require-deck";
import { slideDeckTitle } from "$slide-decks/types/slide-deck";

/**
 * Gives a deck a different name.
 *
 * A rename is the one edit that touches this row rather than appending a change
 * set — the title is the only thing stored here that anyone edits, which is also
 * why it is a function of its own rather than a general `update`.
 */
export const rename = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"slideDecks">,
  title: string
): Promise<void> => {
  await requireDeck(ctx, scope, id);
  const named = slideDeckTitle(title);
  const by: Actor = { kind: "user", userId: scope.userId };

  await ctx.db.patch(id, { title: named, updatedBy: by, updatedAt: Date.now() });

  await record(ctx, scope, {
    actor: by,
    verb: "renamed",
    target: { type: "slideDeck", id, label: named }
  });
};

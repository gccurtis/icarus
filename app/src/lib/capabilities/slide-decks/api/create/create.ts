import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { start } from "$revisions/api/shared/start";
import type { Actor } from "$shared/types/actor";
import { emptySlideDeckBody, type SlideDeckBody } from "$slide-decks/types/body";
import { slideDeckTitle, type AspectRatio } from "$slide-decks/types/slide-deck";

/**
 * Starts a deck: a title, a shape, and a theme with nothing drawn on it.
 *
 * **The row and the anchor are written together**, because a deck whose row
 * committed without one is a deck nothing can open. What an empty body looks
 * like is decided here rather than in `revisions`, which has never inspected one.
 *
 * `aspectRatio` is an argument and the theme is not: the shape is fixed at
 * creation and read by a thumbnail, while the theme is in the body where
 * recolouring is an ordinary, undoable edit.
 *
 * `body` is the one a template supplies, and the empty one otherwise. It is
 * stored as given and never read, which is what makes instantiation a copy that
 * owes its template nothing.
 */
export const create = async (
  ctx: MutationCtx,
  scope: Scope,
  title: string,
  aspectRatio: AspectRatio,
  templateId?: Id<"templates">,
  body?: SlideDeckBody
): Promise<Id<"slideDecks">> => {
  const named = slideDeckTitle(title);
  const by: Actor = { kind: "user", userId: scope.userId };

  const id = await ctx.db.insert("slideDecks", {
    projectId: scope.projectId,
    title: named,
    aspectRatio,
    templateId,
    createdBy: by,
    updatedBy: by,
    updatedAt: Date.now()
  });

  await start(ctx, scope, { resourceType: "slides", resourceId: id }, body ?? emptySlideDeckBody());

  await record(ctx, scope, {
    actor: by,
    verb: "created",
    target: { type: "slideDeck", id, label: named }
  });

  return id;
};

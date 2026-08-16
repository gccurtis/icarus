import { v } from "convex/values";
import { projectMutation, projectQuery } from "$convex/functions";
import { create as createDeck } from "$slide-decks/api/create/create";
import { list as listDecks } from "$slide-decks/api/list/list";
import { remove as removeDeck } from "$slide-decks/api/remove/remove";
import { rename as renameDeck } from "$slide-decks/api/rename/rename";

/**
 * Slide decks' public surface — `api.capabilities.slideDecks.*`.
 *
 * `slideDecks`, not `slide-decks`: Convex rejects a hyphen in a module path, and
 * a module's path is its public name.
 *
 * Everything a browser can do to a deck's metadata, and nothing it can do to its
 * slides: editing is `revisions.submit`, against a table this capability does not
 * own. `aspectRatio` is settable only at creation, because it is the one piece of
 * appearance that is not an edit.
 */
export const list = projectQuery({
  args: {},
  handler: (ctx) => listDecks(ctx, ctx.scope)
});

export const create = projectMutation({
  args: {
    title: v.string(),
    aspectRatio: v.union(v.literal("16:9"), v.literal("4:3")),
    templateId: v.optional(v.string())
  },
  handler: (ctx, args) => createDeck(ctx, ctx.scope, args.title, args.aspectRatio, args.templateId)
});

export const rename = projectMutation({
  args: { deckId: v.id("slideDecks"), title: v.string() },
  handler: (ctx, args) => renameDeck(ctx, ctx.scope, args.deckId, args.title)
});

export const remove = projectMutation({
  args: { deckId: v.id("slideDecks") },
  handler: (ctx, args) => removeDeck(ctx, ctx.scope, args.deckId)
});

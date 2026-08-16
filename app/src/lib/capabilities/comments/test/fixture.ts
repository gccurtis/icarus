import type { Scope } from "$access/types/access";
import { commentsRefusal } from "$comments/errors";
import type { ContentBlock } from "$content/types/block";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { create } from "$documents/api/create/create";
import { emptyDocumentBody, type DocumentBody } from "$documents/types/body";
import { fakeCtx } from "$shared/test/fake-ctx";
import { create as createDeck } from "$slide-decks/api/create/create";
import { emptySlideDeckBody } from "$slide-decks/types/body";

/** The fake `db` is structural; no handler here touches anything else on a ctx. */
export const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
export const scopeOf = (projectId: string, userId: string) =>
  ({ projectId, userId }) as unknown as Scope;

const NOW = 1_700_000_000_000;

/** The caller, and a project they are not asking about to put other people's rows in. */
export const asking = async () => {
  const ctx = fakeCtx();
  const userId = await ctx.db.insert("users", {
    authSubject: "default-user",
    displayName: "Development User",
    updatedAt: NOW
  });
  const mine = await ctx.db.insert("projects", { name: "Development", revision: 1, updatedAt: NOW });
  const theirs = await ctx.db.insert("projects", { name: "Elsewhere", revision: 1, updatedAt: NOW });

  return { ctx, userId, scope: scopeOf(mine, userId), elsewhere: scopeOf(theirs, userId) };
};

/** A paragraph of one literal atom — enough for an anchor to name a block and offsets in it. */
export const paragraph = (id: string, text: string): ContentBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}a`, kind: "literal", text }],
  display: text,
  marks: []
});

export const bodyOf = (...blocks: ContentBlock[]): DocumentBody => ({
  ...emptyDocumentBody(),
  rows: blocks.map((block) => ({ id: `r-${block.id}`, kind: "blocks" as const, blocks: [block] }))
});

/** A document holding the blocks given, so an anchor into it points at something real. */
export const documentOf = async (
  ctx: ReturnType<typeof fakeCtx>,
  scope: Scope,
  ...blocks: ContentBlock[]
): Promise<Id<"documents">> => await create(asCtx(ctx), scope, "Q3 plan", undefined, bodyOf(...blocks));

/** A deck holding one slide, which is the anchor case a document cannot express. */
export const deckOf = async (
  ctx: ReturnType<typeof fakeCtx>,
  scope: Scope,
  slideId: string
): Promise<Id<"slideDecks">> =>
  await createDeck(asCtx(ctx), scope, "Q3 review", "16:9", undefined, {
    ...emptySlideDeckBody(),
    slides: [{ id: slideId, elements: [], notes: [] }]
  });

/** What somebody says. One remark, so a test asserting on a thread reads at a glance. */
export const remark = (text = "Where is this from?"): ContentBlock[] => [paragraph("c1", text)];

/**
 * The refusal a call produced, or `undefined` if it produced none.
 *
 * The payload rather than the message, because the payload is the only part
 * Convex serializes: a plain `Error` still matches `/not found/` here and still
 * reaches the browser as an opaque server fault.
 */
export const refusalFrom = async (call: Promise<unknown>) =>
  await call.then(
    () => undefined,
    (error: unknown) => commentsRefusal(error)
  );

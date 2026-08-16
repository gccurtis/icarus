import type { Scope } from "$access/types/access";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { knowledgeRefusal } from "$knowledge/errors";
import { EMBEDDING_DIMENSIONS } from "$knowledge/schema";
import type { Embedding } from "$knowledge/types/embedding";
import type { LatticeSource } from "$knowledge/types/lattice-source";
import { fakeCtx } from "$shared/test/fake-ctx";

/** The fake `db` is structural; no handler here touches anything else on a ctx. */
export const asCtx = (ctx: ReturnType<typeof fakeCtx>) => ctx as unknown as MutationCtx & QueryCtx;

/** A scope exists only because the gate produced one, so the tests hand one over. */
export const scopeOf = (projectId: string, userId: string) =>
  ({ projectId, userId }) as unknown as Scope;

const NOW = 1_700_000_000_000;

type Ctx = ReturnType<typeof fakeCtx>;

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

export const aDocument = async (ctx: Ctx, scope: Scope, title = "Notes"): Promise<LatticeSource> => ({
  kind: "document",
  id: (await ctx.db.insert("documents", {
    projectId: scope.projectId,
    title,
    createdBy: { kind: "user", userId: scope.userId },
    updatedBy: { kind: "user", userId: scope.userId },
    updatedAt: NOW
  })) as Id<"documents">
});

/**
 * A deterministic embedder with geometry a test can reason about.
 *
 * Every vector is unit length with only its first two components non-zero, so
 * the similarity of two texts is the cosine of the angle between their hashes —
 * known exactly, unlike a real model's. That is a strength rather than a
 * compromise: everything this pass has to prove is about the algorithm, and an
 * embedder whose geometry is a mystery would test it far worse.
 *
 * It records what it was asked for, because the headline property — an
 * unchanged window is not re-embedded — is about the *calls*, not the stored
 * vectors. A test reading only the vectors passes against an implementation that
 * re-embeds everything and happens to get the same answer.
 */
export const fakeEmbedder = (model = "fake-embed-1") => {
  const batches: string[][] = [];

  const angle = (text: string) => {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return ((hash >>> 0) / 2 ** 32) * Math.PI * 2;
  };

  const embedding: Embedding = {
    binding: "embedding",
    model,
    dimensions: EMBEDDING_DIMENSIONS,
    embed: async (texts) => {
      batches.push([...texts]);
      return texts.map((text) => {
        const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
        vector[0] = Math.cos(angle(text));
        vector[1] = Math.sin(angle(text));
        return vector;
      });
    }
  };

  return {
    embedding,
    /** One entry per call, so both the count and the batching are assertable. */
    batches,
    texts: () => batches.flat()
  };
};

/** Long enough to window into several spans, and different every paragraph. */
export const paragraph = (n: number) =>
  `Paragraph ${n}. ${`Sentence about subject ${n}, at some length. `.repeat(40)}`;

/**
 * The refusal a call produced, or `undefined` if it produced none.
 *
 * The payload rather than the message, because the payload is the only part
 * Convex serializes: a plain `Error` still matches `/embedding/` here and still
 * reaches the browser as an opaque server fault.
 */
export const refusalFrom = async (call: Promise<unknown>) =>
  await call.then(
    () => undefined,
    (error: unknown) => knowledgeRefusal(error)
  );

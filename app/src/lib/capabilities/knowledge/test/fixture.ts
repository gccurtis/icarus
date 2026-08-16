import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import { knowledgeRefusal } from "$knowledge/errors";
import { EMBEDDING_DIMENSIONS } from "$knowledge/schema";
import type { Embedding } from "$knowledge/types/embedding";
import type { LatticeWindow } from "$knowledge/types/lattice-node";
import { sourceKey, type LatticeSource } from "$knowledge/types/lattice-source";
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

/** A source of another kind, for the tests that prove a kind never decides admission. */
export const aFinding = async (
  ctx: Ctx,
  scope: Scope,
  title = "What we found"
): Promise<LatticeSource> => ({
  kind: "finding",
  id: (await ctx.db.insert("findings", {
    projectId: scope.projectId,
    title,
    createdBy: { kind: "user", userId: scope.userId },
    updatedAt: NOW
  })) as Id<"findings">
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

/** A node the way a pass would have left it, with a direction the test chose. */
export const aNode = async (
  ctx: Ctx,
  scope: Scope,
  node: {
    centroid: number[];
    level?: number;
    tierSourceId?: string;
    clustered?: boolean;
    windows?: LatticeWindow[];
    text?: string;
    members?: Id<"latticeNodes">[];
    parentId?: Id<"latticeNodes">;
    cohesion?: number;
    staleAt?: number;
  }
): Promise<Id<"latticeNodes">> =>
  (await ctx.db.insert("latticeNodes", {
    projectId: scope.projectId,
    level: node.level ?? 0,
    tierSourceId: node.tierSourceId,
    clustered: node.clustered ?? false,
    windows: node.windows ?? [],
    text: node.text,
    centroid: node.centroid,
    count: node.members?.length,
    cohesion: node.cohesion,
    members: node.members,
    parentId: node.parentId,
    staleAt: node.staleAt,
    updatedAt: NOW
  })) as Id<"latticeNodes">;

/** Every lattice node a project holds, straight out of the fake store. */
export const latticeNodes = (ctx: Ctx, scope: Scope): Doc<"latticeNodes">[] =>
  [...ctx.rows.entries()]
    .filter(([, row]) => row._table === "latticeNodes" && row.projectId === scope.projectId)
    .map(([id, row]) => ({ _id: id, ...row }) as unknown as Doc<"latticeNodes">);

const RADIANS = Math.PI / 180;

/** A unit vector `degrees` off `axis`, leaning towards `tilt`. Four dimensions is enough. */
export const tilted = (axis: number, tilt: number, degrees: number): number[] => {
  const vector = [0, 0, 0, 0];
  vector[axis] = Math.cos(degrees * RADIANS);
  vector[tilt] = Math.sin(degrees * RADIANS);
  return vector;
};

/**
 * A unit vector on `axis`, leaning `degrees` towards the space's last dimension.
 *
 * One spare dimension is what lets a group be tight without pulling any other
 * group towards it: members of a group differ only in how far they lean, so two
 * groups on different axes stay near-orthogonal however many of them there are.
 */
export const leaning = (width: number, axis: number, degrees: number): number[] => {
  const vector = new Array<number>(width).fill(0);
  vector[axis] = Math.cos(degrees * RADIANS);
  vector[width - 1] = Math.sin(degrees * RADIANS);
  return vector;
};

/**
 * A clustered lattice: `groups` documents, each windowed into `per` overlapping
 * spans under a cluster of its own, each group facing an axis nobody else uses.
 *
 * **The point is that growing it changes nothing a query reaches.** A query aimed
 * at one group scores every other group near zero, so descent opens one branch
 * whether the corpus holds two of them or twenty — which is the property the
 * hierarchy exists for and cannot be shown on a corpus of one shape.
 *
 * Window spans overlap by design, so a group's windows merge back into one
 * region and the text of that region can be compared against the document's.
 */
export const aCorpus = async (
  ctx: Ctx,
  scope: Scope,
  { groups, per = 4 }: { groups: number; per?: number }
) => {
  const width = groups + 1;
  const sources: LatticeSource[] = [];
  const texts: string[] = [];
  const clusters: Id<"latticeNodes">[] = [];

  for (let group = 0; group < groups; group++) {
    const source = await aDocument(ctx, scope, `Group ${group}`);
    const body = paragraph(group);
    sources.push(source);
    texts.push(body);

    const members: Id<"latticeNodes">[] = [];
    for (let index = 0; index < per; index++) {
      const start = index * 300;
      const end = Math.min(start + 400, body.length);
      members.push(
        await aNode(ctx, scope, {
          centroid: leaning(width, group, (index - (per - 1) / 2) * 3),
          tierSourceId: sourceKey(source),
          clustered: true,
          windows: [{ source, start, end, density: 1 }],
          text: body.slice(start, end)
        })
      );
    }

    const cluster = await aNode(ctx, scope, {
      level: 1,
      centroid: leaning(width, group, 0),
      members
    });
    for (const member of members) await ctx.db.patch(member, { parentId: cluster });
    clusters.push(cluster);
  }

  return { width, sources, texts, clusters };
};

/**
 * An embedder that answers every text with the same direction.
 *
 * A query's vector is the only input retrieval has, so a test says what it is
 * asking for by naming the direction rather than by finding a string that hashes
 * near one.
 */
export const aimedEmbedder = (vector: number[], model = "fake-embed-1") => {
  const asked: string[] = [];

  const embedding: Embedding = {
    binding: "embedding",
    model,
    dimensions: vector.length,
    embed: async (texts) => {
      asked.push(...texts);
      return texts.map(() => [...vector]);
    }
  };

  return { embedding, asked };
};

/**
 * The geometry the clustering tests are argued from: two tight groups a right
 * angle apart, one artifact equally close to both, and two close to nothing.
 *
 * **The bridge is the point.** It belongs in both groups' cliques and in neither
 * group, which is what makes the result a lattice rather than a tree — and it
 * only shows up in a geometry with more than two dimensions, because on a circle
 * anything near two groups puts those groups near each other.
 *
 * Every bridge similarity is `cos10/√2` **exactly** — the same product summed in
 * the same order — so the level's 75th percentile lands on it and the four edges
 * sit *at* the threshold rather than above it. That is deliberate: it is what
 * makes "at or above" a claim the test can fail.
 */
export const bridgedGroups = () => ({
  a1: tilted(0, 2, 10),
  a2: tilted(0, 2, -10),
  b1: tilted(1, 2, 10),
  b2: tilted(1, 2, -10),
  bridge: [Math.SQRT1_2, Math.SQRT1_2, 0, 0],
  loner: [0, 0, 0, 1],
  drifter: [0, 0, -1, 0]
});

/**
 * `groups` bundles of `per` vectors, each bundle leaning on an axis of its own,
 * in a space `width` wide with a little energy in **every** dimension.
 *
 * The noise is the point, not decoration. A pool whose vectors are pure axes
 * projects into any basis losslessly, so a projected score and a full-dimensional
 * one would agree — and the defect this pass exists to avoid, scoring with the
 * projection, would pass every test. Energy outside the basis is what makes the
 * two answers differ enough to tell apart.
 *
 * The bundles stay far enough apart that the grouping is not in doubt, which is
 * what lets the approximate path be compared against the exact one for equality
 * rather than for resemblance.
 */
export const separatedGroups = ({
  groups,
  per,
  width
}: {
  groups: number;
  per: number;
  width: number;
}): number[][] => {
  const vectors: number[][] = [];
  for (let group = 0; group < groups; group++) {
    for (let member = 0; member < per; member++) {
      const vector = Array.from({ length: width }, (_, t) =>
        Math.sin(1 + t * 1.7 + member * 0.9 + group * 5.1) * 0.03
      );
      vector[group % width] += 1;
      const length = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
      vectors.push(vector.map((value) => value / length));
    }
  }
  return vectors;
};

/**
 * One undifferentiated blob: every vector leaning on the same axis, differing
 * only in how the noise fell.
 *
 * Everything `separatedGroups` is not, and that is what it is for. A pool with
 * structure has a 75th percentile down among the cross-group pairs, which the
 * floor then clamps — so a threshold read off the wrong distribution is hidden.
 * This pool's own percentile sits far above the floor, where a wrong one shows
 * up as a number.
 */
export const cone = ({ count, width }: { count: number; width: number }): number[][] =>
  Array.from({ length: count }, (_, index) => {
    const vector = Array.from(
      { length: width },
      (_, t) => Math.sin(1 + t * 1.7 + index * 0.9) * 0.9
    );
    vector[0] += 1;
    const length = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
    return vector.map((value) => value / length);
  });

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

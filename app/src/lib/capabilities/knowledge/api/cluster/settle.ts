import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { grow } from "$knowledge/api/cluster/grow";
import { mergeWindows } from "$knowledge/api/cluster/merge-windows";
import { nodeId } from "$knowledge/api/cluster/node-id";
import { centroidOf, cohesionOf, dot, similarityMatrix } from "$knowledge/api/cluster/similarity";

/**
 * `knowledge.clustering.knn.repairMaxFraction` and `.repairMaxDrift` in
 * `configuration/knowledge.yaml`, mirrored because a Convex isolate has no
 * filesystem. `test/unit/configuration.test.ts` fails if they disagree.
 */
export const REPAIR_MAX_FRACTION = 0.2;
export const REPAIR_MAX_DRIFT = 0.02;

/** Below this a centroid did not move; it was summed in a different order. */
const UNMOVED = 1e-9;

export type SettleResult = {
  readonly created: number;
  readonly dissolved: number;
  readonly rebuilt: boolean;
};

type Damaged = {
  readonly node: Doc<"latticeNodes">;
  readonly surviving: Doc<"latticeNodes">[];
  readonly drift: number;
};

type Damage = {
  readonly fraction: number;
  readonly drift: number;
  readonly damaged: Damaged[];
};

/**
 * Whether a tier is past patching.
 *
 * **Drift matters independently of fraction.** A single member replaced by
 * something very different invalidates a centroid entirely — the cluster still
 * has all its members and no longer means what it says — and a fraction-only
 * rule would happily keep it. The fraction is the cost argument: past a point,
 * rebuilding is cheaper than patching what is left.
 */
export const needsRebuild = (damage: { fraction: number; drift: number }): boolean =>
  damage.fraction > REPAIR_MAX_FRACTION || damage.drift > REPAIR_MAX_DRIFT;

/** The clusters of one tier. A source tier's windows are level 0 and not clusters. */
const tierNodes = async (ctx: MutationCtx, scope: Scope, tierSourceId: string | undefined) =>
  (
    await ctx.db
      .query("latticeNodes")
      .withIndex("by_tier_source", (q) =>
        q.eq("projectId", scope.projectId).eq("tierSourceId", tierSourceId)
      )
      .collect()
  ).filter((node) => node.level > 0);

/**
 * What the tier's next pass clusters.
 *
 * The corpus tier's pool is **every** unclustered node in the project, whatever
 * tier or level produced it: it is the union of the source frontiers, and a
 * level-0 window that never found a home inside its own source belongs in it
 * exactly as much as a source's root cluster does.
 */
const tierFrontier = async (ctx: MutationCtx, scope: Scope, tierSourceId: string | undefined) => {
  if (tierSourceId === undefined) {
    return await ctx.db
      .query("latticeNodes")
      .withIndex("by_project_clustered", (q) =>
        q.eq("projectId", scope.projectId).eq("clustered", false)
      )
      .collect();
  }

  return (
    await ctx.db
      .query("latticeNodes")
      .withIndex("by_tier_source", (q) =>
        q.eq("projectId", scope.projectId).eq("tierSourceId", tierSourceId)
      )
      .collect()
  ).filter((node) => !node.clustered);
};

/**
 * How far each cluster is from the members it claims to stand for.
 *
 * One measure covers both ways a cluster goes wrong — a member deleted and a
 * member re-embedded — because both show up in the same place: the centroid the
 * cluster would have if it were built now.
 */
const assess = async (
  ctx: MutationCtx,
  scope: Scope,
  nodes: readonly Doc<"latticeNodes">[]
): Promise<Damage> => {
  const damaged: Damaged[] = [];
  let drift = 0;

  for (const node of nodes) {
    const members = node.members ?? [];
    const surviving: Doc<"latticeNodes">[] = [];
    for (const id of members) {
      const member = await ctx.db.get(id);
      if (member && member.projectId === scope.projectId) surviving.push(member);
    }

    const moved =
      surviving.length === 0
        ? 1
        : 1 - dot(node.centroid, centroidOf(surviving.map((member) => member.centroid)));
    if (surviving.length === members.length && moved <= UNMOVED) continue;

    damaged.push({ node, surviving, drift: moved });
    drift = Math.max(drift, moved);
  }

  return { fraction: nodes.length === 0 ? 0 : damaged.length / nodes.length, drift, damaged };
};

/** A node whose members no longer point at it puts them back on the frontier. */
const free = async (ctx: MutationCtx, memberIds: readonly Id<"latticeNodes">[]) => {
  for (const id of memberIds) {
    const member = await ctx.db.get(id);
    if (!member) continue;
    const parent = member.parentId ? await ctx.db.get(member.parentId) : null;
    if (!parent) await ctx.db.patch(id, { clustered: false, parentId: undefined });
  }
};

const dissolve = async (ctx: MutationCtx, node: Doc<"latticeNodes">) => {
  await ctx.db.delete(node._id);
  await free(ctx, node.members ?? []);
};

/**
 * Bring each damaged cluster up to date in place, keeping its identity.
 *
 * Only reached when the drift is small, so a cluster here still means what it
 * meant. One that has fallen below two surviving members does not, whatever its
 * centroid says, so it is dissolved rather than patched — and its member goes
 * back on the frontier, where the next pass can find it a home.
 */
const repair = async (ctx: MutationCtx, damage: Damage): Promise<number> => {
  const at = Date.now();
  let dissolved = 0;

  for (const { node, surviving } of damage.damaged) {
    if (surviving.length < 2) {
      await dissolve(ctx, node);
      dissolved++;
      continue;
    }

    const matrix = similarityMatrix(surviving.map((member) => member.centroid));
    await ctx.db.patch(node._id, {
      centroid: centroidOf(surviving.map((member) => member.centroid)),
      count: surviving.length,
      cohesion: cohesionOf(
        (a, b) => matrix[a][b],
        surviving.map((_, index) => index)
      ),
      windows: mergeWindows(surviving.flatMap((member) => member.windows)),
      members: surviving.map((member) => member._id),
      // It has just been recomputed from what is there now, so whatever marked
      // it out of date is answered.
      staleAt: undefined,
      updatedAt: at
    });
  }

  return dissolved;
};

/**
 * Put every member of a tier's clusters back on the frontier, leaving the
 * clusters themselves standing.
 *
 * A rebuild re-derives the grouping rather than the rows: what the new pass
 * reaches again keeps its row, so the set is released before it is re-clustered
 * and swept afterwards.
 */
const release = async (ctx: MutationCtx, nodes: readonly Doc<"latticeNodes">[]) => {
  const setAside = new Set<string>(nodes.map((node) => node._id));
  for (const node of nodes) {
    for (const id of node.members ?? []) {
      const member = await ctx.db.get(id);
      if (member?.parentId && setAside.has(member.parentId)) {
        await ctx.db.patch(id, { clustered: false, parentId: undefined });
      }
    }
  }
};

/**
 * Bring one tier back into agreement with what it is built from, then cluster
 * whatever is on its frontier.
 *
 * Repair or rebuild is a cost decision with a correctness floor: patching is
 * cheaper right up until the clusters stop meaning what they say, which is what
 * `needsRebuild` draws the line at. Growing afterwards is not conditional —
 * a tier with new artifacts and no damage at all is the ordinary case.
 */
export const settle = async (
  ctx: MutationCtx,
  scope: Scope,
  tierSourceId: string | undefined
): Promise<SettleResult> => {
  const nodes = await tierNodes(ctx, scope, tierSourceId);
  const damage = await assess(ctx, scope, nodes);
  const rebuilt = damage.damaged.length > 0 && needsRebuild(damage);

  let dissolved = 0;
  const reusable = new Map<string, Doc<"latticeNodes">>();
  const setAside = new Set<string>();
  if (rebuilt) {
    await release(ctx, nodes);
    for (const node of nodes) {
      reusable.set(nodeId(node.members ?? []), node);
      setAside.add(node._id);
    }
  } else if (damage.damaged.length > 0) {
    dissolved = await repair(ctx, damage);
  }

  // A released cluster is not itself an artifact to cluster: it is the thing
  // being re-derived, and leaving it in the pool would cluster a node with the
  // members it stands for.
  const frontier = (await tierFrontier(ctx, scope, tierSourceId)).filter(
    (node) => !setAside.has(node._id)
  );
  const grown = await grow(ctx, scope, tierSourceId, frontier, reusable);

  // What the new grouping did not reach again is a cluster that no longer
  // exists. What it did reach kept its row, because a cluster *is* its members.
  for (const [key, node] of reusable) {
    if (!grown.reused.has(key)) await ctx.db.delete(node._id);
  }

  return { created: grown.written.length - grown.reused.size, dissolved, rebuilt };
};

import type { Scope } from "$access/types/access";
import type { Doc } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { settle } from "$knowledge/api/cluster/settle";
import { advanceVersion, readVersion } from "$knowledge/api/shared/version";
import type { ClusterPass } from "$knowledge/types/clustering";

const NOTHING: ClusterPass = {
  tiers: 0,
  created: 0,
  dissolved: 0,
  rebuilt: 0,
  levelCount: 0,
  reclustered: []
};

const projectNodes = async (ctx: MutationCtx, scope: Scope) =>
  await ctx.db
    .query("latticeNodes")
    .withIndex("by_project_clustered", (q) => q.eq("projectId", scope.projectId))
    .collect();

/** A list of levels as counts indexed by level, with the gaps filled in. */
const perLevel = (levels: readonly number[]): number[] => {
  const counts: number[] = [];
  for (const level of levels) counts[level] = (counts[level] ?? 0) + 1;
  return Array.from(counts, (count) => count ?? 0);
};

/**
 * How many nodes stand at each level, counted rather than accumulated.
 *
 * A pass moves nodes between levels and deletes some of them, so a running total
 * would drift; this is one scan of what is actually there.
 */
const countByLevel = (nodes: readonly Doc<"latticeNodes">[]): number[] => {
  const counts: number[] = [];
  for (const node of nodes) counts[node.level] = (counts[node.level] ?? 0) + 1;
  // Level 0 exists the moment anything is ingested, so an empty count is one
  // level holding nothing rather than no lattice at all.
  return counts.length === 0 ? [0] : Array.from(counts, (count) => count ?? 0);
};

/**
 * One clustering pass over a project.
 *
 * **Source tiers first, corpus tier last.** The corpus tier is built out of the
 * source frontiers, so settling it before them would cluster artifacts that are
 * about to move — and the source tiers are what a changed document damages.
 *
 * The pass takes no argument saying what changed, because it does not need one:
 * damage is read off the clusters themselves, and the work queue is the stored
 * `clustered: false` set. That is also retrieval's frontier, so one index
 * answers both readers and neither can disagree about what is outstanding.
 *
 * A project with no lattice version has never been ingested. There is nothing to
 * cluster and nothing to record, which is an ordinary state rather than a fault.
 */
export const cluster = async (ctx: MutationCtx, scope: Scope): Promise<ClusterPass> => {
  const version = await readVersion(ctx, scope);
  if (!version) return NOTHING;

  const tiers = [
    ...new Set(
      (await projectNodes(ctx, scope))
        .map((node) => node.tierSourceId)
        .filter((tier): tier is string => tier !== undefined)
    )
  ].sort();

  let created = 0;
  let dissolved = 0;
  let rebuilt = 0;
  const writtenLevels: number[] = [];
  for (const tier of [...tiers, undefined]) {
    const result = await settle(ctx, scope, tier);
    created += result.created;
    dissolved += result.dissolved;
    if (result.rebuilt) rebuilt++;
    writtenLevels.push(...result.writtenLevels);
  }

  const nodes = await projectNodes(ctx, scope);
  const nodesByLevel = countByLevel(nodes);
  await advanceVersion(ctx, version._id, {
    nodesByLevel,
    // Recomputed rather than adjusted: repair answers the staleness that
    // provoked it and a rebuild deletes it, so a delta would count marks that
    // no longer exist.
    staleCount: nodes.filter((node) => node.staleAt !== undefined).length
  });

  return {
    tiers: tiers.length,
    created,
    dissolved,
    rebuilt,
    levelCount: nodesByLevel.length,
    // How far up the pass reached, which is the only thing a reader of the
    // history wants from a cascade — a source change invalidates its windows,
    // the cluster over them, the cluster over that, and every id would be unread.
    reclustered: perLevel(writtenLevels)
  };
};

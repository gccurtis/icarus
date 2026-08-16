import type { Scope } from "$access/types/access";
import type { Doc, Id } from "$convex/_generated/dataModel";
import type { QueryCtx } from "$convex/_generated/server";
import { dot } from "$knowledge/api/cluster/similarity";

/**
 * `knowledge.retrieval.beam`, `.threshold`, and `.maxExpansions` in
 * `configuration/knowledge.yaml`, mirrored because a Convex isolate has no
 * filesystem. `test/unit/configuration.test.ts` fails if they disagree.
 */
export const DESCENT_BEAM = 3;
export const DESCENT_THRESHOLD = 0.35;
export const MAX_EXPANSIONS = 256;

/** A window descent reached, and the best score anything reached it with. */
export type Reached = Map<Id<"latticeNodes">, number>;

type Candidate = {
  readonly id: Id<"latticeNodes">;
  readonly score: number;
  /** A window is terminal: it has no members and nothing below it to open. */
  readonly terminal: boolean;
};

/** Strongest first, and by id where two score alike, so one pool descends one way. */
const strongestFirst = (left: Candidate, right: Candidate) =>
  right.score - left.score || (left.id < right.id ? -1 : 1);

/** Into a descending-sorted queue, at the position the comparator names. */
const insert = (queue: Candidate[], entry: Candidate) => {
  let low = 0;
  let high = queue.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (strongestFirst(queue[mid], entry) < 0) low = mid + 1;
    else high = mid;
  }
  queue.splice(low, 0, entry);
};

/**
 * Best-first descent from the frontier, with a beam, a threshold, and a ceiling.
 *
 * **A node's centroid is what makes this work.** It approximates its members, so
 * a cluster scoring poorly means everything beneath it scores poorly and the
 * branch is never opened — which is why cost is bounded by `beam ×
 * maxExpansions` rather than by the size of the corpus. A corpus ten times
 * larger has more levels, and each level is one more hop rather than one more
 * scan.
 *
 * **Nothing above the threshold means nothing comes back.** There is no fallback
 * scan: a query with no good answer says so, rather than returning the least-bad
 * passages in the project, which read as answers and are not.
 *
 * A node in another project is not followed. The parent chain and the member
 * list are exactly where a stray write would cross the boundary unnoticed.
 */
export const descend = async (
  ctx: QueryCtx,
  scope: Scope,
  query: readonly number[],
  entered: readonly Doc<"latticeNodes">[]
): Promise<Reached> => {
  const reached: Reached = new Map();
  const visited = new Set<Id<"latticeNodes">>();
  const record = (id: Id<"latticeNodes">, score: number) => {
    const best = reached.get(id);
    if (best === undefined || score > best) reached.set(id, score);
  };

  const queue: Candidate[] = entered
    .map((node) => ({
      id: node._id,
      score: dot(query, node.centroid),
      terminal: node.level === 0
    }))
    .sort(strongestFirst);

  let expansions = 0;
  // The queue is score-sorted, so the moment its best is below the threshold
  // nothing left in it can be above one.
  while (queue.length > 0 && queue[0].score >= DESCENT_THRESHOLD) {
    for (const candidate of queue.splice(0, DESCENT_BEAM)) {
      if (visited.has(candidate.id) || candidate.score < DESCENT_THRESHOLD) continue;
      visited.add(candidate.id);

      if (candidate.terminal) {
        record(candidate.id, candidate.score);
        continue;
      }

      if (expansions >= MAX_EXPANSIONS) return reached;
      expansions++;

      const node = await ctx.db.get(candidate.id);
      if (!node || node.projectId !== scope.projectId) continue;

      for (const memberId of node.members ?? []) {
        // Cliques overlap, so a member can be held twice. It is one artifact
        // with one score however many holders reach it.
        if (visited.has(memberId)) continue;
        const member = await ctx.db.get(memberId);
        if (!member || member.projectId !== scope.projectId) continue;

        const score = dot(query, member.centroid);
        if (member.level > 0) {
          insert(queue, { id: memberId, score, terminal: false });
          continue;
        }

        visited.add(memberId);
        if (score >= DESCENT_THRESHOLD) record(memberId, score);
      }
    }
  }

  return reached;
};

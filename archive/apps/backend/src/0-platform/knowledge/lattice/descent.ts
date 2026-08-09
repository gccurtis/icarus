import type { FrontierEntry, KnowledgeNode, KnowledgeWindow } from "#platform/knowledge/types.js";
import type { KnowledgeStore } from "#platform/knowledge/store.js";
import { isWindowId } from "#platform/knowledge/types.js";
import { cosineSim } from "#platform/knowledge/lattice/math.js";

export const DEFAULT_BEAM = 3;
export const DEFAULT_THRESHOLD = 0.35;
const MAX_EXPANSIONS = 256;

export interface DescentResult {
  windowIds: string[];
  scores: Map<string, number>; // windowId → best cosine similarity
}

/**
 * Best-first descent from the corpus frontier. Scores are cosine similarities
 * to queryVec (all stored vectors are unit-normalized).
 *
 * Returns the IDs of all reached windows with their best score. If no
 * frontier exists or no window exceeds the threshold, returns empty arrays —
 * there is no fallback scan.
 */
export async function descent(
  queryVec: number[],
  store: KnowledgeStore,
  beam: number,
  threshold: number
): Promise<DescentResult> {
  const frontier = await store.getFrontier();
  if (frontier.length === 0) {
    return { windowIds: [], scores: new Map() };
  }

  // Score frontier entries and seed the priority queue
  const pq: Array<{ id: string; score: number; isWindow: boolean }> = frontier.map((f) => ({
    id: f.id,
    score: cosineSim(queryVec, f.vector),
    isWindow: f.isWindow
  }));

  // Min-heap would be efficient but for the typical frontier size (< 10k),
  // a sorted array kept trimmed to beam works fine and is simpler.
  const visited = new Set<string>();
  const windowScores = new Map<string, number>();
  let expansions = 0;

  // Collect and sort all frontier entries
  const active: Array<{ id: string; score: number; isWindow: boolean }> = [...pq];
  active.sort((a, b) => b.score - a.score);

  while (active.length > 0 && expansions < MAX_EXPANSIONS) {
    // Pop best beam candidates
    const candidates = active.splice(0, beam);

    for (const cand of candidates) {
      if (visited.has(cand.id)) continue;
      visited.add(cand.id);

      if (cand.score < threshold) continue;

      if (cand.isWindow || isWindowId(cand.id)) {
        // Terminal: record best score for this window
        const prev = windowScores.get(cand.id);
        if (prev === undefined || cand.score > prev) {
          windowScores.set(cand.id, cand.score);
        }
        // Windows have no children in the descent graph
        continue;
      }

      expansions++;

      // Expand: load this node's children
      const [node] = await store.getNodes([cand.id]);
      if (!node) continue;

      for (const memberId of node.memberIds) {
        if (visited.has(memberId)) continue;
        const memberIsWindow = isWindowId(memberId);

        if (memberIsWindow) {
          // Load window to get its embedding
          const [win] = await store.getWindows([memberId]);
          if (!win) continue;
          const score = cosineSim(queryVec, win.embedding);
          if (score >= threshold) {
            const prev = windowScores.get(memberId);
            if (prev === undefined || score > prev) {
              windowScores.set(memberId, score);
            }
          }
        } else {
          // Load child node to score its centroid
          const [childNode] = await store.getNodes([memberId]);
          if (!childNode) continue;
          const score = cosineSim(queryVec, childNode.centroid);
          insertSorted(active, { id: memberId, score, isWindow: false });
        }
      }
    }
  }

  return {
    windowIds: [...windowScores.keys()],
    scores: windowScores
  };
}

/** Insert into a descending-sorted array, keeping it trimmed. */
function insertSorted(
  arr: Array<{ id: string; score: number; isWindow: boolean }>,
  entry: { id: string; score: number; isWindow: boolean }
): void {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].score > entry.score) lo = mid + 1;
    else hi = mid;
  }
  arr.splice(lo, 0, entry);
}

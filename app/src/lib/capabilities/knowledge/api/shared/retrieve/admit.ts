import type { Region } from "$knowledge/types/retrieval";

/**
 * `knowledge.retrieval.charBudget` and `.topK` in `configuration/knowledge.yaml`,
 * mirrored because a Convex isolate has no filesystem.
 * `test/unit/configuration.test.ts` fails if they disagree.
 */
export const CHAR_BUDGET = 4000;
export const TOP_K = 5;

/** What a region of density 2 or more may spend beyond the budget. */
const DENSE_OVERAGE = 1.25;

/** Strongest first, and by density where two score alike. */
const bestFirst = (left: Region, right: Region) =>
  right.relevance - left.relevance || right.density - left.density;

/**
 * Rank the regions and admit what the budget affords.
 *
 * Density breaks a tie for a reason: two regions scoring alike are not equally
 * useful — one assembled from several overlapping windows is material the query
 * kept landing on, and one from a single window is a passing mention.
 *
 * Two exceptions keep the budget from being perverse:
 *
 * - **The top region is always admitted**, even alone over budget. A truncated
 *   best answer beats no answer.
 * - **A region of density 2 or more gets a quarter over.** Cutting substantial
 *   material to admit two thin ones is the wrong trade.
 *
 * A region too large for what is left does not stop the walk. The budget is a
 * budget rather than a stopping point, and something that fits after something
 * else did not is still worth its characters.
 */
export const admit = (regions: readonly Region[], limit = TOP_K): Region[] => {
  const ranked = [...regions].sort(bestFirst);
  const admitted: Region[] = [];
  let spent = 0;

  for (const region of ranked) {
    if (admitted.length >= limit) break;

    const affordable = region.density >= 2 ? CHAR_BUDGET * DENSE_OVERAGE : CHAR_BUDGET;
    if (admitted.length > 0 && spent + region.text.length > affordable) continue;

    admitted.push(region);
    spent += region.text.length;
  }

  return admitted;
};

import type { Scope } from "$access/types/access";
import type { Doc } from "$convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "$convex/_generated/server";
import type { LevelIndex } from "$knowledge/types/level-index";

/** The index one level was clustered through, or nothing if that level never was. */
export const readLevelIndex = async (
  ctx: QueryCtx,
  scope: Scope,
  level: number
): Promise<Doc<"latticeLevelIndexes"> | null> =>
  await ctx.db
    .query("latticeLevelIndexes")
    .withIndex("by_project_level", (q) => q.eq("projectId", scope.projectId).eq("level", level))
    .first();

/**
 * Whether a stored index was fitted under parameters that no longer hold.
 *
 * **This is the whole reason `threshold` and `k` sit beside the basis.** Without
 * them, a row fitted at another `k` — or over a pool that has since moved,
 * which is what a changed threshold means — is indistinguishable from one that
 * still describes its level, and would be used rather than refitted.
 */
export const staleLevelIndex = (
  stored: Pick<LevelIndex, "threshold" | "k">,
  fitted: Pick<LevelIndex, "threshold" | "k">
): boolean => stored.threshold !== fitted.threshold || stored.k !== fitted.k;

/**
 * Record what a level was clustered through.
 *
 * **One row per (project, level), and this is what makes that true** — Convex
 * has no unique index, so the invariant is a read-then-write inside a
 * serializable transaction rather than a constraint.
 *
 * An index whose parameters still describe its level is **left alone**. The
 * basis is by far the largest row this capability writes, and rewriting it every
 * pass to move a timestamp costs far more than the timestamp is worth; a basis
 * that has drifted a little behind its pool costs recall in candidate selection
 * and nothing at all in the answers, because every score is full-dimensional.
 */
export const writeLevelIndex = async (
  ctx: MutationCtx,
  scope: Scope,
  index: LevelIndex
): Promise<void> => {
  const stored = await readLevelIndex(ctx, scope, index.level);
  if (stored && !staleLevelIndex(stored, index)) return;

  const row = {
    projectId: scope.projectId,
    level: index.level,
    threshold: index.threshold,
    k: index.k,
    basis: index.basis,
    centroids: index.centroids,
    updatedAt: Date.now()
  };

  // Replaced whole rather than patched: nothing of an index fitted under other
  // parameters survives into the one that replaces it.
  if (stored) await ctx.db.replace(stored._id, row);
  else await ctx.db.insert("latticeLevelIndexes", row);
};

import type { Scope } from "$access/types/access";
import type { MutationCtx } from "$convex/_generated/server";
import type { Setting } from "$settings/types/settings";
import { canonicalKey } from "$settings/types/settings";

/**
 * Writes one setting, creating it if this project has not set it before.
 *
 * **Read-then-write is safe here without a unique index, which Convex does not
 * have.** A mutation is one serializable transaction, and the index range this
 * reads is part of its read set — so a concurrent write of the same key forces
 * this one to re-run, and the re-run sees the row and patches it. Two callers
 * setting the same key cannot both insert.
 *
 * The key is canonicalized before the lookup rather than after, so `Editor.Theme`
 * and `editor.theme` contend for one row instead of quietly becoming two.
 */
export const set = async (
  ctx: MutationCtx,
  scope: Scope,
  key: string,
  value: unknown
): Promise<Setting> => {
  const canonical = canonicalKey(key);
  if (canonical.length === 0) throw new Error("A setting key cannot be empty");

  const existing = await ctx.db
    .query("settings")
    .withIndex("by_project_and_key", (q) =>
      q.eq("projectId", scope.projectId).eq("key", canonical)
    )
    .unique();

  const written = { value: JSON.stringify(value), updatedAt: Date.now() };

  if (existing) {
    await ctx.db.patch(existing._id, written);
  } else {
    await ctx.db.insert("settings", { projectId: scope.projectId, key: canonical, ...written });
  }

  return { key: canonical, value };
};

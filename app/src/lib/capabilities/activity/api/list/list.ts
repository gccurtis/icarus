import type { Scope } from "$access/types/access";
import type { Activity } from "$activity/types/activity";
import type { QueryCtx } from "$convex/_generated/server";

/**
 * One project's log, newest first.
 *
 * Newest first is what a feed means, and it is also what makes the eventual
 * `.paginate()` a drop-in: the page a reader wants is already at the head of the
 * range, so nothing above this has to change when the log outgrows one read.
 *
 * Unpaged today, and unlike `settings.list` that is a real deadline rather than
 * a shrug — activity is append-only and grows without bound. What buys the delay
 * is that a young project's log is tens of rows, not that it will stay that way.
 */
export const list = async (ctx: QueryCtx, scope: Scope): Promise<Activity[]> => {
  const rows = await ctx.db
    .query("activity")
    .withIndex("by_project", (q) => q.eq("projectId", scope.projectId))
    .order("desc")
    .collect();

  // The row's own `projectId` and ids stop here: every entry returned is from
  // the project that was asked about, so repeating it per entry says nothing.
  return rows.map(({ actor, actorLabel, verb, target, context, detail, at }) => ({
    actor,
    actorLabel,
    verb,
    target,
    context,
    detail,
    at
  }));
};

import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { endpointIn } from "$research-links/api/shared/endpoint";
import { ResearchLinksError } from "$research-links/errors";
import type { Actor } from "$shared/types/actor";

/**
 * Withdraws one edge.
 *
 * **A real delete, and it says nothing about either end.** An edge is an
 * assertion about two objects rather than a thing with a history, so a withdrawn
 * one leaves no state behind — and because `link` refuses a duplicate, this is
 * also how a bearing that was drawn wrong gets corrected.
 *
 * Both ends are read for the log before the row goes, and each falls back to its
 * kind when the object is already gone: an edge pointing at a deleted question
 * is the one most worth removing, so failing on a missing label would block the
 * cleanup it exists for.
 */
export const unlink = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"researchLinks">
): Promise<void> => {
  const row = await ctx.db.get(id);
  if (!row || row.projectId !== scope.projectId) {
    throw new ResearchLinksError("not-found", `Link not found: ${id}`);
  }

  const bearer = await endpointIn(ctx, scope, row.bearerKind, row.bearerId);
  const subject = await endpointIn(ctx, scope, row.subjectKind, row.subjectId);

  await ctx.db.delete(id);

  await record(ctx, scope, {
    actor: { kind: "user", userId: scope.userId } satisfies Actor,
    verb: "unlinked",
    target: { type: "researchLink", id, label: bearer?.label ?? row.bearerKind },
    context: {
      type: row.subjectKind,
      id: row.subjectId,
      label: subject?.label ?? row.subjectKind
    }
  });
};

import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { requireFinding } from "$findings/api/shared/require-finding";
import { FindingsError } from "$findings/errors";
import { findingSources, findingTitle, type FindingDraft } from "$findings/types/finding";
import type { Actor } from "$shared/types/actor";

/**
 * Replaces a finding with the version the author has in front of them.
 *
 * **A patch, not a new version.** A finding has no edit history: the citer keeps
 * what it read — a derived output records the revision it generated against, a
 * report copies the quote it used — so nothing here has to keep a full copy of
 * the body per edit.
 *
 * **`revision` is the stale-form check.** Convex's transactions cover a read and
 * a write inside one mutation; they do not cover a writeup somebody spends an
 * afternoon on, which is exactly what this edits.
 */
export const revise = async (
  ctx: MutationCtx,
  scope: Scope,
  id: Id<"findings">,
  revision: number,
  draft: FindingDraft
): Promise<void> => {
  const finding = await requireFinding(ctx, scope, id);

  if (finding.revision !== revision) {
    throw new FindingsError("stale", `Finding ${id} has moved to revision ${finding.revision}`);
  }

  const title = findingTitle(draft.title);
  const sources = findingSources(draft.sources);
  const by: Actor = { kind: "user", userId: scope.userId };

  await ctx.db.patch(id, {
    title,
    body: draft.body,
    sources,
    updatedBy: by,
    revision: finding.revision + 1,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    verb: "revised",
    target: { type: "finding", id, label: title }
  });
};

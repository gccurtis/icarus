import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { findingSources, findingTitle, type FindingDraft } from "$findings/types/finding";
import type { Actor } from "$shared/types/actor";

/**
 * Writes a finding down, and returns its id.
 *
 * **No question, no hypothesis, and it takes neither.** Research turns up things
 * nobody was looking for, and requiring an attachment would push those into the
 * wrong question or lose them. Attachment is a research link, added whenever the
 * connection is made.
 *
 * **The sources are stored as read.** Canonicalizing runs over what the author
 * typed and leaves every excerpt alone, because the excerpt is the copy the
 * citation exists for.
 */
export const create = async (
  ctx: MutationCtx,
  scope: Scope,
  draft: FindingDraft
): Promise<Id<"findings">> => {
  const title = findingTitle(draft.title);
  const sources = findingSources(draft.sources);
  const by: Actor = { kind: "user", userId: scope.userId };

  const id = await ctx.db.insert("findings", {
    projectId: scope.projectId,
    title,
    body: draft.body,
    sources,
    createdBy: by,
    updatedBy: by,
    revision: 1,
    updatedAt: Date.now()
  });

  await record(ctx, scope, {
    actor: by,
    verb: "recorded",
    target: { type: "finding", id, label: title }
  });

  return id;
};

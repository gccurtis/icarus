import type { Scope } from "$access/types/access";
import { record } from "$activity/api/shared/record";
import type { Id } from "$convex/_generated/dataModel";
import type { MutationCtx } from "$convex/_generated/server";
import { endpointIn, type Endpoint, type EndpointKind } from "$research-links/api/shared/endpoint";
import { ResearchLinksError } from "$research-links/errors";
import {
  researchLinkBearing,
  researchLinkNote,
  researchLinkPair,
  type NewLink
} from "$research-links/types/research-link";
import type { Actor } from "$shared/types/actor";

/** An end the caller cannot see is answered as one that is not there. */
const endOf = async (
  ctx: MutationCtx,
  scope: Scope,
  kind: EndpointKind,
  id: string
): Promise<Endpoint> => {
  const endpoint = await endpointIn(ctx, scope, kind, id);
  if (!endpoint) {
    throw new ResearchLinksError("not-found", `${kind} not found: ${id}`);
  }
  return endpoint;
};

/**
 * Draws one edge: this bearer bears on this subject, and here is how.
 *
 * **The pair is the edge's identity**, so the same two ends cannot be linked
 * twice whatever bearing or note comes with the second attempt. Convex has no
 * unique index, so the check is a read of `by_bearer_subject` followed by an
 * insert — safe because a mutation is one serializable transaction, which is why
 * there is no retry loop and no version column here.
 *
 * **Direction is canonical** — finding → hypothesis → question — and both
 * endpoints are proved to sit in the caller's project before anything is
 * written. That is what lets every index lead with `projectId` and what keeps a
 * `(kind, id)` pair from naming a row nothing will ever read.
 */
export const link = async (
  ctx: MutationCtx,
  scope: Scope,
  draft: NewLink
): Promise<Id<"researchLinks">> => {
  researchLinkPair(draft.bearerKind, draft.subjectKind);
  const bearing = researchLinkBearing(draft.bearerKind, draft.bearing);
  const note = researchLinkNote(draft.note);

  const bearer = await endOf(ctx, scope, draft.bearerKind, draft.bearerId);
  const subject = await endOf(ctx, scope, draft.subjectKind, draft.subjectId);

  const existing = await ctx.db
    .query("researchLinks")
    .withIndex("by_bearer_subject", (q) =>
      q
        .eq("projectId", scope.projectId)
        .eq("bearerKind", draft.bearerKind)
        .eq("bearerId", bearer.id)
        .eq("subjectKind", draft.subjectKind)
        .eq("subjectId", subject.id)
    )
    .first();
  if (existing) {
    throw new ResearchLinksError(
      "duplicate",
      `That ${draft.bearerKind} already bears on that ${draft.subjectKind}`
    );
  }

  const by: Actor = { kind: "user", userId: scope.userId };
  const id = await ctx.db.insert("researchLinks", {
    projectId: scope.projectId,
    bearerKind: draft.bearerKind,
    bearerId: bearer.id,
    subjectKind: draft.subjectKind,
    subjectId: subject.id,
    bearing,
    note,
    createdBy: by
  });

  await record(ctx, scope, {
    actor: by,
    verb: "linked",
    target: { type: "researchLink", id, label: bearer.label },
    // What it was linked to, so the log reads without opening the edge.
    context: { type: draft.subjectKind, id: subject.id, label: subject.label }
  });

  return id;
};

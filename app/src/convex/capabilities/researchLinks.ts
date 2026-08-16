import { v } from "convex/values";
import { projectMutation, projectQuery } from "$convex/functions";
import { bearers as bearersOf } from "$research-links/api/bearers/bearers";
import { link as drawLink } from "$research-links/api/link/link";
import { subjects as subjectsOf } from "$research-links/api/subjects/subjects";
import { unlink as removeLink } from "$research-links/api/unlink/unlink";
import {
  linkBearerKindValidator,
  linkBearingValidator,
  linkSubjectKindValidator
} from "$research-links/types/research-link";

/**
 * Research links' public surface — `api.capabilities.researchLinks.*`.
 *
 * **The validators are the direction.** `bearerKind` admits no question and
 * `subjectKind` admits no finding, so a reversed edge is refused at the door and
 * the pairing the kinds still allow — a hypothesis on a hypothesis — is refused
 * by the handler.
 *
 * **`bearers` and `subjects` are the same edges read from either end**, each in
 * one indexed read, which is what a join table buys over an array on either
 * side.
 */
export const bearers = projectQuery({
  args: {
    subjectKind: linkSubjectKindValidator,
    subjectId: v.string(),
    /** Proposals and evidence render as separate lists off the same question. */
    bearerKind: v.optional(linkBearerKindValidator)
  },
  handler: (ctx, args) => bearersOf(ctx, ctx.scope, args, args.bearerKind)
});

export const subjects = projectQuery({
  args: { bearerKind: linkBearerKindValidator, bearerId: v.string() },
  handler: (ctx, args) => subjectsOf(ctx, ctx.scope, args)
});

export const link = projectMutation({
  args: {
    bearerKind: linkBearerKindValidator,
    bearerId: v.string(),
    subjectKind: linkSubjectKindValidator,
    subjectId: v.string(),
    /** Findings only; the handler refuses it on anything else. */
    bearing: v.optional(linkBearingValidator),
    note: v.optional(v.string())
  },
  handler: (ctx, args) => drawLink(ctx, ctx.scope, args)
});

export const unlink = projectMutation({
  args: { linkId: v.id("researchLinks") },
  handler: (ctx, args) => removeLink(ctx, ctx.scope, args.linkId)
});

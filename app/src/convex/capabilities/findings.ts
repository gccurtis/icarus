import { v } from "convex/values";
import { blockValidator } from "$content/types/block";
import { projectMutation, projectQuery } from "$convex/functions";
import { create as createFinding } from "$findings/api/create/create";
import { list as listFindings } from "$findings/api/list/list";
import { read as readFinding } from "$findings/api/read/read";
import { revise as reviseFinding } from "$findings/api/revise/revise";
import { findingSourceValidator } from "$findings/types/finding";

/**
 * Findings' public surface — `api.capabilities.findings.*`.
 *
 * **No function here takes a question id, a hypothesis id, or a bearing.** All
 * three are research links, because all three relationships are many-to-many.
 *
 * **`list` and `read` are separate on purpose.** A finding's body is its
 * substance, and a list that carried it would ship every writeup in the project
 * to print a column of titles.
 */
export const list = projectQuery({
  args: {},
  handler: (ctx) => listFindings(ctx, ctx.scope)
});

export const read = projectQuery({
  args: { findingId: v.id("findings") },
  handler: (ctx, args) => readFinding(ctx, ctx.scope, args.findingId)
});

export const create = projectMutation({
  args: {
    title: v.string(),
    body: v.array(blockValidator),
    sources: v.array(findingSourceValidator)
  },
  handler: (ctx, args) => createFinding(ctx, ctx.scope, args)
});

export const revise = projectMutation({
  args: {
    findingId: v.id("findings"),
    revision: v.number(),
    title: v.string(),
    body: v.array(blockValidator),
    sources: v.array(findingSourceValidator)
  },
  handler: (ctx, args) => reviseFinding(ctx, ctx.scope, args.findingId, args.revision, args)
});

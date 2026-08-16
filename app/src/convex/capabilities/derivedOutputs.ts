import { v } from "convex/values";
import { blockValidator } from "$content/types/block";
import { projectMutation, projectQuery } from "$convex/functions";
import { create as createOutput } from "$derived-outputs/api/create/create";
import { list as listOutputs } from "$derived-outputs/api/list/list";
import { read as readOutput } from "$derived-outputs/api/read/read";
import { refresh as refreshOutput } from "$derived-outputs/api/refresh/refresh";
import { derivedInputValidator } from "$derived-outputs/types/derived-output";
import { setExpressionValidator } from "$shared/types/set-expression";

/**
 * Derived outputs' public surface — `api.capabilities.derivedOutputs.*`.
 *
 * **Nothing here writes content.** `refresh` asks for a generation and returns
 * what a generator needs; recording what one produced is
 * [`completeGeneration` and `failGeneration`](../../lib/capabilities/derived-outputs/api/shared/shared.md),
 * registered nowhere — a client that could write a body under an output's id
 * could put anything in someone's report and date it as generated.
 *
 * **`shaping` is an argument to `refresh` and is stored nowhere.** It is the
 * prompt block's presented copy, passed to the generator as the shape to
 * preserve; the output keeps the canonical generated version.
 */
export const list = projectQuery({
  args: {},
  handler: (ctx) => listOutputs(ctx, ctx.scope)
});

export const read = projectQuery({
  args: { derivedOutputId: v.id("derivedOutputs") },
  handler: (ctx, args) => readOutput(ctx, ctx.scope, args.derivedOutputId)
});

export const create = projectMutation({
  args: {
    prompt: v.string(),
    inputs: v.array(derivedInputValidator),
    scope: v.optional(setExpressionValidator)
  },
  handler: (ctx, args) => createOutput(ctx, ctx.scope, args)
});

export const refresh = projectMutation({
  args: {
    derivedOutputId: v.id("derivedOutputs"),
    /** One block, because a prompt block is one block. The validator is what refuses a list. */
    shaping: v.optional(blockValidator)
  },
  handler: (ctx, args) => refreshOutput(ctx, ctx.scope, args.derivedOutputId, args.shaping)
});

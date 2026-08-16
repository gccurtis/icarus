import { v, type Infer } from "convex/values";

/**
 * One piece of work done while producing a turn.
 *
 * **`input` and `output` are opaque.** Every tool's payload is different and the
 * tool implementation is the only thing that can interpret its own arguments, so
 * normalizing them into a schema here would either exclude a tool or describe
 * none of them.
 *
 * **A research step is one of these.** Research once recorded searched-this,
 * read-that separately from an agent's tool calls; they were the same thing
 * described twice, because research is an agent with a fixed toolset and a
 * search *is* a tool call.
 *
 * Nothing reads this to decide what to do next — it is a record of work done,
 * not a plan, and that is what keeps it honest.
 */
export const toolCallValidator = v.object({
  name: v.string(),
  input: v.any(),
  output: v.optional(v.any()),
  state: v.union(v.literal("pending"), v.literal("success"), v.literal("error")),
  error: v.optional(v.string()),
  durationMs: v.optional(v.number())
});

export type ToolCall = Infer<typeof toolCallValidator>;

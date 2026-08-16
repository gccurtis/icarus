import { v, type Infer } from "convex/values";

/**
 * Which thread a turn belongs to.
 *
 * **There is no thread object and no thread id column.** A research thread, an
 * agent task, and a persona thread each *are* threads, so the consumer's own
 * `_id` is what this names — the link is the index, and neither side stores a
 * pointer at the other to keep in sync.
 *
 * `id` stays one indexed column across all three variants — a Convex id *is* a
 * string — so no reader has to choose a branch to render one conversation. Each
 * variant names its own table, which is what stops a turn being posted against
 * an id minted somewhere else.
 */
export const threadRefValidator = v.union(
  v.object({ kind: v.literal("research"), id: v.id("researchThreads") }),
  v.object({ kind: v.literal("task"), id: v.id("agentTasks") }),
  v.object({ kind: v.literal("persona"), id: v.id("personaThreads") })
);

export type ThreadRef = Infer<typeof threadRefValidator>;

export type ThreadKind = ThreadRef["kind"];

import { v, type Infer } from "convex/values";

/**
 * Which thread a turn belongs to.
 *
 * **There is no thread object and no thread id column.** A research thread, an
 * agent task, and a persona thread each *are* threads, so the consumer's own
 * `_id` is what this names — the link is the index, and neither side stores a
 * pointer at the other to keep in sync.
 *
 * `id` is `v.string()` in all three variants because it is one indexed column
 * holding ids minted for three different tables; a union of `v.id`s would make
 * every reader choose a branch to render one conversation. `researchThreads` and
 * `personaThreads` arrive later in this pass and `agentTasks` in pass 7, so
 * today it is also the only thing that compiles.
 */
export const threadRefValidator = v.union(
  v.object({ kind: v.literal("research"), id: v.string() }),
  v.object({ kind: v.literal("task"), id: v.string() }),
  v.object({ kind: v.literal("persona"), id: v.string() })
);

export type ThreadRef = Infer<typeof threadRefValidator>;

export type ThreadKind = ThreadRef["kind"];

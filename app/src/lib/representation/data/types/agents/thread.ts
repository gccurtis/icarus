import type { Id } from "$representation/data/types/core/id";

/** Which of the three tables owns this conversation. The way back from a bare thread id. */
export type ThreadKind = "researchThread" | "personaThread" | "agentTask";

/**
 * Where a conversation was cut to start another.
 *
 * No thread kind — `threads.kind` holds it. `index` says which message, since
 * `messageId` is only unique within its own thread.
 */
export type BranchPoint = { threadId: Id<"threads">; messageId: string; index: number };

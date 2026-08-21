/**
 * Where a task stands.
 *
 * `waiting` is not `running` — a task blocked on human input consumes nothing.
 * `cancelled` is not `failed` — somebody stopping a task is not an error.
 */
export type AgentTaskStatus =
  | "draft"
  | "running"
  | "waiting"
  | "complete"
  | "failed"
  | "cancelled";

/**
 * Which message is the instruction. Not the first message: a task can begin from
 * a conversation already in progress, and everything before the prompt is
 * inherited context.
 *
 * A reference rather than a copy, so the instruction cannot drift.
 */
export type TaskPrompt = { messageId: string; index: number };

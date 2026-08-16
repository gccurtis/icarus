import { ConvexError } from "convex/values";

export type AgentTasksErrorCode =
  /** A task, a parent, or a branch point that is absent or in another project. Never told apart. */
  | "not-found"
  /** A task nothing in a feed could identify — and no `detail` for its actor label. */
  | "empty-title"
  /** A task with no instruction to run. */
  | "empty-prompt"
  /** A task that has already stopped. Complete, failed, and cancelled are terminal. */
  | "already-finished"
  /** A move the lifecycle does not have — running a task that is already running. */
  | "bad-transition";

export type AgentTasksRefusal = {
  readonly capability: "agentTasks";
  readonly code: AgentTasksErrorCode;
  readonly message: string;
};

/**
 * A refusal this capability chose, told apart from a fault.
 *
 * Convex serializes a `ConvexError`'s payload and redacts everything else, so a
 * refusal thrown as a plain `Error` reaches its caller as a server fault. That
 * caller is usually a runner rather than a person, and one told "server error"
 * retries; one told `already-finished` stops.
 */
export class AgentTasksError extends ConvexError<AgentTasksRefusal> {
  constructor(code: AgentTasksErrorCode, message: string) {
    super({ capability: "agentTasks", code, message });
  }
}

/** The class does not survive the wire, so a caller reads the payload instead. */
export const agentTasksRefusal = (error: unknown): AgentTasksRefusal | undefined => {
  const data: unknown = (error as { data?: unknown })?.data;
  return typeof data === "object" &&
    data !== null &&
    (data as AgentTasksRefusal).capability === "agentTasks"
    ? (data as AgentTasksRefusal)
    : undefined;
};

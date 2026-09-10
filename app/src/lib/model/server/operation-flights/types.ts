export type ResearchFlightReason = "cancelled" | "deadline" | "shutdown";

/** Structural signal reason reserved for process-owned Derived Output shutdown. */
export class OperationFlightsShutdownError extends Error {
  constructor() {
    super("Server shutdown aborted the operation");
    this.name = "OperationFlightsShutdownError";
  }
}

/** A read-only handle to one research turn owned by this process. */
export interface ResearchFlight {
  readonly signal: AbortSignal;
  stopping(): boolean;
  reason(): ResearchFlightReason | undefined;
}

export type ResearchStopOutcome = "answering" | "cancelled" | "missing";

/** A person's explicit request to stop one Agent task. */
export class AgentTaskCancelledError extends Error {
  constructor() {
    super("The Agent task was stopped");
    this.name = "AgentTaskCancelledError";
  }
}

/** The process-owned deadline for one Agent task elapsed. */
export class AgentTaskDeadlineError extends Error {
  constructor() {
    super("The Agent task ran past its deadline");
    this.name = "AgentTaskDeadlineError";
  }
}

export type AgentTaskFlight<T> = {
  readonly started: boolean;
  readonly promise: Promise<T>;
};

/**
 * Process-local operation coordination.
 *
 * Durable jobs remain in the Store. This object owns only promises,
 * AbortControllers, and deadline timers whose lifetime cannot outlive a process.
 */
export interface OperationFlightsModel {
  derivedRequestKey(key: string): string | undefined;
  updateDerivedRequestKey(key: string, requestKey: string): void;
  shareDerived<T>(
    key: string,
    requestKey: string,
    run: (signal: AbortSignal) => Promise<T>
  ): { readonly started: boolean; readonly promise: Promise<T> };

  beginResearch(turnId: string): ResearchFlight;
  research(turnId: string): ResearchFlight | undefined;
  isResearchActive(turnId: string): boolean;
  armResearchDeadline(turnId: string, ms: number): () => void;
  requestResearchStop(turnId: string): ResearchStopOutcome;
  endResearch(turnId: string): void;

  runAgentTask<T>(
    taskId: string,
    deadlineMs: number,
    run: (signal: AbortSignal) => Promise<T>
  ): AgentTaskFlight<T>;
  isAgentTaskActive(taskId: string): boolean;
  stopAgentTask(taskId: string): boolean;

  /** Abort owned work and resolve only after every flight has finished settling. */
  close(): Promise<void>;
}

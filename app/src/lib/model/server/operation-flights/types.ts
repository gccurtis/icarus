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

  /** Abort owned work and resolve only after every flight has finished settling. */
  close(): Promise<void>;
}

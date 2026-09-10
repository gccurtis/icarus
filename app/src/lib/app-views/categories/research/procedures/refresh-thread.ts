type Refreshable = {
  refresh(): Promise<unknown>;
};

export type ThreadRefreshOutcome =
  | { readonly state: "refreshed" }
  | { readonly state: "stale" }
  | { readonly state: "failed"; readonly error: unknown };

export type ThreadRefreshInput = {
  readonly detail: Refreshable;
  /** Whether this result still belongs to the mounted, selected chat. */
  current(): boolean;
  /** True once the durable running turn has reached the refreshed query. */
  hasRunningTurn(): boolean;
  /** The workspace-owned Send command, when this mount raced its persistence. */
  pendingFlight(): Promise<unknown> | undefined;
  /** Injected only by unit tests; production uses a short bounded backoff. */
  waitForRetry?(milliseconds: number): Promise<void>;
};

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Reconcile one mounted chat with its durable detail.
 *
 * Usually this is one read. If the surface remounted while its workspace-owned
 * Send command was still crossing the server boundary, retry until either the
 * running turn is visible or that command settles, then make one final read.
 */
export const refreshThread = async (
  input: ThreadRefreshInput
): Promise<ThreadRefreshOutcome> => {
  const flight = input.pendingFlight();
  const flightSettled = flight?.then(
    () => "settled" as const,
    () => "settled" as const
  );
  let retryAfter = 25;

  while (input.current()) {
    try {
      await input.detail.refresh();
    } catch (error) {
      return input.current() ? { state: "failed", error } : { state: "stale" };
    }

    if (!input.current()) return { state: "stale" };
    if (flight === undefined || input.hasRunningTurn()) return { state: "refreshed" };

    if (input.pendingFlight() !== flight) {
      // The command refreshes this query after its terminal write, and this read
      // happened after the workspace released that command.
      return { state: "refreshed" };
    }

    const pause = (input.waitForRetry ?? wait)(retryAfter).then(() => "retry" as const);
    const outcome = await Promise.race([flightSettled!, pause]);
    if (!input.current()) return { state: "stale" };
    if (outcome === "settled") {
      try {
        await input.detail.refresh();
      } catch (error) {
        return input.current() ? { state: "failed", error } : { state: "stale" };
      }
      return input.current() ? { state: "refreshed" } : { state: "stale" };
    }
    retryAfter = Math.min(retryAfter * 2, 500);
  }

  return { state: "stale" };
};

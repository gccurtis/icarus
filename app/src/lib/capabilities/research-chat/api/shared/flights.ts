/**
 * The turns this process is actually running.
 *
 * A turn's row says running; only this says it is still true. Nothing survives a
 * restart, so a running row whose id is not here was stranded by a crash or a
 * deploy and can be recovered rather than waited on forever.
 *
 * Held on globalThis so development module replacement does not lose a run in
 * flight, and reached through a function so importing this module builds nothing.
 */
type Flight = {
  readonly controller: AbortController;
  stopping: boolean;
  /** Why the controller was aborted, when it was. */
  reason?: "cancelled" | "deadline";
};

const globalState = globalThis as typeof globalThis & {
  __icarusResearchChatFlights?: Map<string, Flight>;
};

const flights = (): Map<string, Flight> => {
  const held = globalState.__icarusResearchChatFlights;
  if (held !== undefined) return held;
  const created = new Map<string, Flight>();
  globalState.__icarusResearchChatFlights = created;
  return created;
};

export const beginFlight = (turnId: string): Flight => {
  const flight: Flight = { controller: new AbortController(), stopping: false };
  flights().set(turnId, flight);
  return flight;
};

/**
 * The whole run's bound.
 *
 * The port's timeout bounds one provider request, so an unbounded loop of them
 * has no bound at all. This is the one that ends the turn.
 */
export const abandonAfter = (flight: Flight, ms: number): (() => void) => {
  const timer = setTimeout(() => {
    flight.reason ??= "deadline";
    flight.controller.abort();
  }, ms);
  return () => clearTimeout(timer);
};

export const endFlight = (turnId: string): void => {
  flights().delete(turnId);
};

export const flightFor = (turnId: string): Flight | undefined => flights().get(turnId);

/** A turn this process is not running, whatever its row says. */
export const isStranded = (turnId: string): boolean => !flights().has(turnId);

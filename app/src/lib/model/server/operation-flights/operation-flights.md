# Operation flights

## Ownership

`OperationFlights` owns process-local promises, abort controllers, and deadline
timers for Derived Output refreshes and Research Chat turns. Durable operation
state belongs to Store rows; capabilities remain stateless procedures.

## Lifetime

The server composition root constructs one instance per process. It is closed
before observability during server shutdown. Closing aborts active Derived Output
work with the typed `OperationFlightsShutdownError`, aborts Research work with
its existing `shutdown` reason, clears deadlines, and then waits for every
flight's catch and finally work to settle before it releases the flight. The
typed reason lets a capability distinguish process release from an ordinary
provider or user-facing failure without parsing error text. Nothing here
survives restart.

## Invariants

- One derived-output key names at most one active promise.
- One research-turn id names at most one controller and deadline.
- A first research stop asks the run to finish; a second aborts it.
- No new flight starts after shutdown begins.
- `close()` is idempotent and resolves only after every owned promise settles.
- A shutdown-interrupted Derived Output claim returns to durable `queued` state
  without spending an attempt; a fresh process can reclaim that exact request.
- Durable recovery decisions use Store rows plus whether this owner has the run.

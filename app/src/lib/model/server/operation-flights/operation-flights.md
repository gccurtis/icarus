# Operation flights

## Ownership

`OperationFlights` owns process-local promises, abort controllers, and deadline
timers for Derived Output refreshes and Research Chat turns. Durable operation
state belongs to Store rows; capabilities remain stateless procedures.

## Lifetime

The server composition root constructs one instance per process. It is closed
before observability during server shutdown. Closing aborts active provider work,
clears deadlines, and releases every flight. Nothing here survives restart.

## Invariants

- One derived-output key names at most one active promise.
- One research-turn id names at most one controller and deadline.
- A first research stop asks the run to finish; a second aborts it.
- No new flight starts after shutdown begins.
- Durable recovery decisions use Store rows plus whether this owner has the run.

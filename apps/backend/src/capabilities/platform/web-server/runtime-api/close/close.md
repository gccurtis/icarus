# API: `close`

Lives at `runtime-api/close/close.md`.

Called once, first in the runtime shutdown sequence — before the database closes
and before observability flushes — because an in-flight request must not find its
database gone.

## Classification

- **Owner:** `WebServerRuntime`
- **Execution:** mutator
- **Transaction:** none
- **Entry:** [`close.ts`](close.ts)

## Inputs

None. The Fastify instance is supplied by the runtime object.

## Output

`Promise<void>`

Resolves once the server has stopped accepting connections and Fastify has
finished with the requests already in flight.

## Failures

None defined by this capability. A close error rejects the promise and reaches
the shutdown sequence, which reports it and sets a failing exit code.

## Effects

- The listening socket is released.
- In-flight requests are allowed to finish; new connections are refused.

## Procedure Tree

```text
1. Close the Fastify instance.
2. return
```

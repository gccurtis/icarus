# API: `listen`

Lives at `runtime-api/listen/listen.md`.

Starts serving. Called once during startup, after `registerTransport`, with a
host and port the caller has already validated.

## Classification

- **Owner:** `WebServerRuntime`
- **Execution:** mutator
- **Transaction:** none
- **Entry:** [`listen.ts`](listen.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `address` | `ListenAddress` | The host and port to bind. This capability validates neither; a caller that read them from configuration owns that. |

## Output

`Promise<string>`

The address actually bound, as Fastify reports it. It is not always the address
requested: port `0` binds an ephemeral port, and the returned string is how the
caller — and a test — learns which one.

## Failures

None defined by this capability. A bind error, such as a port already in use,
rejects the promise and reaches the startup sequence, which logs
`backend.start.failed` and closes what it had already opened.

## Effects

- The server begins accepting connections and dispatching them through the
  handler `registerTransport` installed.

## Procedure Tree

```text
receive address
  1. Bind the Fastify instance to the host and port.
     || binding fails
        1.a.1. reject with the framework error
  2. return the bound address
```

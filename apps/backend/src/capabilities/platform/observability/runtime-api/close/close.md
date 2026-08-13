# API: `close`

Lives at `runtime-api/close/close.md`.

Called once, by the runtime shutdown sequence in `main.ts`, after the web server
and the database have closed. It runs last because the records those closings
produce must still reach stdout.

## Classification

- **Owner:** `ObservabilityRuntime`
- **Execution:** mutator
- **Transaction:** none
- **Entry:** [`close.ts`](close.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `root` | `pino.Logger` | The root logger to flush, supplied by the runtime object |

## Output

`Promise<void>`

Resolves once Pino reports the buffered output written.

## Failures

None defined by this capability. A flush error from Pino rejects the promise and
reaches the shutdown sequence, which reports it and sets a failing exit code.

## Effects

- Buffered log records are written to stdout.

The logger is not disabled afterwards. A later call records into a flushed
logger; it does not throw.

## Procedure Tree

```text
receive root
  1. Ask Pino to flush.
     || Pino reports an error
        1.a.1. reject with it
  2. resolve
```

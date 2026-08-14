# API: `close`

Lives at `runtime-api/close/close.md`.

Called once, by the runtime shutdown sequence in `runtime/shutdown.ts`, after the
web server and the database have closed. It runs last because the records those
closings produce must still reach the destination.

## Classification

- **Owner:** `ObservabilityRuntime`
- **Execution:** mutator
- **Transaction:** none
- **Entry:** [`close.ts`](close.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `root` | `pino.Logger` | The root logger to flush, supplied by the runtime object |
| `stream` | `ClosableLogStream \| undefined` | The log file this runtime opened, when it opened one |

`stream` is absent for a piped destination, and that absence is the mechanism: a
runtime writing to a standard stream holds nothing closable, so this procedure
cannot end file descriptor 1 or 2 even if asked to.

## Output

`Promise<void>`

Resolves once Pino reports the buffered output written, and — for a file
destination — once the file is closed.

## Failures

None defined by this capability. A flush error from Pino, or a stream error while
closing, rejects the promise and reaches the shutdown sequence, which reports it
and sets a failing exit code.

## Effects

- Buffered log records are written to the destination.
- A log file this runtime opened is closed, releasing its descriptor.

The logger is not disabled afterwards. A later call records into a flushed
logger; it does not throw. After a file has been closed, a later call has nowhere
to land — which is why `close` is called once, at the end.

## Procedure Tree

```text
receive root, stream?
  1. Ask Pino to flush.
     || Pino reports an error
        1.a.1. reject with it
  2. || a stream was opened by this runtime
        2.a.1. End it and await its close event.
           || the stream reports an error
              2.a.1.a.1. reject with it
  3. resolve
```

The order is not interchangeable. Ending the stream first can drop records Pino
has accepted but not yet written, which would lose exactly the shutdown records
this method exists to preserve.

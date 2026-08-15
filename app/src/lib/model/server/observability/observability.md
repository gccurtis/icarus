# Observability

## Description

Observability holds one root logger for the process, and the log stream if it
opened one, so that every capability records what it did through four methods
that name no library.

## Ownership Boundary

Observability owns:

- the root logger, its level, and the envelope every record is written in
- the log file, when the destination is a file — creating it and closing it

Consumers own:

- what they record and when, and the meaning of the data they attach

Callers depend on `Logger` rather than on Pino, so swapping the backend is one
file, and so instrumentation stays explicit at boundaries instead of arriving
through a library's ambient global.

## Lifetime

- **Instance:** one per server process
- **Constructed by:** `buildServerModel`, immediately after configuration and
  before anything whose failure has to be reported
- **Released by:** process shutdown, last — after the databases, so their own
  close records still reach the destination

## Public Methods

| Method | Shape | Effect | Description |
| ------ | ----- | ------ | ----------- |
| `close` | file | mutator | Flushes the root logger, then ends a stream this object opened |

A simple method has no document of its own. [`methods/methods.md`](methods/methods.md)
lists it.

## Exposed State

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `logger` | `readonly Logger` | The four-method port every record goes through |

`logger` is readonly, so a consumer cannot swap the destination of records
everything else in the process is still writing.

## Construction

```ts
export const createObservability = (configuration: Configuration): Observability => ...;
```

Every call returns a fresh object over its own root logger.

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| `configuration` | BORROWED | Read once for level, enablement, and destination |
| the destination stream | OWNED — only when the destination is a file | Written to, and ended at shutdown |

Every configuration key is read before anything is opened, so a misconfigured
destination throws with nothing acquired.

A disabled logger opens nothing at all. Creating a log file for a logger that
will never write to it leaves an empty file per run as the only evidence that
logging is off.

## Destinations differ in ownership, not in file descriptor

```yaml
destination:
  kind: piped   # this process retains nothing; whatever runs it owns collection
  kind: file    # this process owns creating the file and closing it
```

Only a file destination yields a stream to close. **A piped destination must
never be closed** — ending descriptor 1 or 2 would take stdout or stderr away
from everything else in the process. That is why the object holds the stream
only when it opened one, rather than holding a descriptor and a flag.

## What goes in a record

Application data goes in one predictable field, `data`. Pino owns the envelope —
time, level, message, bindings — and serializes it safely, including the cycles
and getters an application value might carry.

`errorFields` reduces an unknown thrown value to a name and a message. It travels
with the interface because reducing a fault to log fields is a logging concern;
in the backend it sat in the web server, which made every capability's
instrumentation depend on the transport.

## Terminal Behaviour

- **Terminal operation:** `close`
- **Releases, in this order:** the buffered records first, then the stream. Pino
  buffers, so ending the stream before flushing drops exactly the records a
  shutdown is being read for.
- **After release:** later writes are accepted by Pino and go nowhere. Nothing
  throws, because a failing shutdown path must not be made worse by the logger
  it is reporting through.

## Concurrency and SSR

- Writing is synchronous from the caller's view: a record is handed to Pino and
  the buffer is its problem.
- `close` is the only asynchronous member. It is called once, by the composition
  root, after everything that logs has already closed.

## Invariants

- A stream this object did not open is never ended.
- The root logger is flushed before any stream is ended.
- The level and destination are fixed at construction. Reconfiguration is a new
  process, which is what keeps every record in one run comparable.

## File Tree

```text
observability/
├── observability.md
├── index.server.ts
├── types.ts
├── definition.ts
├── constructor.ts
├── methods/
│   ├── methods.md
│   └── close.ts
└── test/
```

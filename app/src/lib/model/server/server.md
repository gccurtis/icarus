# The Server Model

One server process owns one server graph. A multi-process deployment has one
graph per worker. The graph holds process infrastructure only; user and project
identity arrive per request through `Scope`.

## The objects

| Object | Owns |
| ------ | ---- |
| [`configuration`](configuration/configuration.md) | One frozen snapshot of `configuration/*.yaml`, read once |
| [`observability`](observability/observability.md) | The root logger, and the log stream if it opened one |

They are built in that order, and released in the reverse of it. Logging is built
first among the releasable objects and closed last, so anything released before
it still has somewhere to record that it was.

## Three verbs, and who calls each

| Function | Called by | Returns |
| --- | --- | --- |
| `initServerModel` | `hooks.server.ts`'s `init` hook, once | the graph, and holds it |
| `buildServerModel` | that initializer, and tests | a complete graph; pure composition |
| `create<Object>` | `buildServerModel`, once each | one fresh object |

```text
hooks.server.ts  init()          before the first request is answered
└── initServerModel()
    └── buildServerModel()
        ├── configuration
        └── observability

serverModel()                    every later caller
├── throw after shutdown begins
├── throw before init ran
└── otherwise the one graph
```

`buildServerModel` is directly callable, so a test holds a whole graph without
touching process state. `serverModel()` holds the one instance and is what
application code calls. The two answer different questions: what a graph is made
of, and which graph this process has.

## Why the build happens in `init`

Not at module load: this module is imported by `hooks.server.ts`, and building at
import would make a configuration error a module-load failure with no logger to
report it.

Not on the first request either, which is what `init` buys. One build at a known
moment means there is no in-flight promise to cache, no race between concurrent
first callers reading configuration twice and opening the same log file, and no
failed build to evict. A bad configuration fails startup rather than one unlucky
request.

The accessor is therefore synchronous, and it distinguishes its two refusals: a
caller arriving during the drain hears "shutting down", and one arriving before
startup finished hears "not built". Collapsing them would report a defect and an
ordinary shutdown in the same words.

## Shutdown is one-way

`closeServerModel()` latches a flag as well as releasing the instance, and the
flag is the part that matters. Releasing alone would leave the door unable to
tell a request arriving mid-drain from one arriving before startup — and the
window is real: the Node adapter drains in-flight requests for up to thirty
seconds after the signal, and keep-alive connections keep delivering.

Shutdown releases what the graph holds — today the log stream, and nothing
else. It is idempotent: a second call does nothing, and no call after it revives
the graph.

## Scoped accessors live on this root

Configuration and the logger are one per process and vary with nothing, so a
caller takes them off the graph the door hands back.

Anything that varies with the request cannot be taken off the graph, because the
value depends on something known only when the procedure runs. It is a call on
this root taking what it varies by. It belongs here rather than beside the object
it reaches: that object's module exports a constructor while the built instance
is held here, so an accessor inside it would have to reach back up to the
composition root. Each scoped accessor gets its own name rather than joining a
bundle.

The graph names one field per object and no shortcuts through them. A `logger`
beside the `observability` that owns it would be a second name for one thing,
free to disagree with the first the moment either moved.

## The doors

`index.server.ts` and `scope.server.ts`, and nothing else. Identity is a door of
its own because `scope.server.ts` reaches the graph to read configuration —
folding it behind `index.server.ts` would mean the root re-exporting values from
a module that imports the root back out. It stays narrow: identity in, `Scope`
out, and no process object reachable through it.

`hooks.server.ts` builds the graph in its `init` hook and places the same
reference on each request's locals in `handle`. It does not construct a graph per
request, and `handle` does not await one.

## File tree

```text
server/
├── server.md
├── index.server.ts        the door, the one instance, and shutdown
├── types.ts               ServerModel
├── constructor.server.ts  buildServerModel
├── scope.server.ts        request identity
├── test/                  lifetime and composition
├── configuration/
└── observability/
```

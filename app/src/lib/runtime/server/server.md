# The Server Model

One server process owns one server graph. A multi-process deployment has one
graph per worker. The graph holds process infrastructure only; user and project
identity arrive per request through `Scope`.

## The objects

| Object | Owns |
| ------ | ---- |
| [`configuration`](configuration/configuration.md) | One frozen snapshot of `configuration/*.yaml`, read once |
| [`embedding`](../../model/server/embedding/embedding.md) | The server-only semantic embedding port |
| [`external-file-storage`](../../model/server/external-file-storage/external-file-storage.md) | Immutable content-addressed native External bytes and reconciliation |
| [`intelligence`](../../model/server/intelligence/intelligence.md) | The bounded tool-calling model port |
| [`observability`](observability/observability.md) | The root logger, and the log stream if it opened one |
| [`operation-flights`](../../model/server/operation-flights/operation-flights.md) | Process-local promises, abort controllers, and deadlines |
| [`store`](../../model/server/store/store.md) | The represented tables and their persistence boundary |

The composition root builds each object once. Shutdown closes operation flights
before observability, so active provider calls are aborted while there is still a
logger available to record their completion.

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
        ├── observability
        ├── store (journal recovery completes in construction)
        ├── external-file-storage
        ├── strict External row admission + native reconciliation
        ├── embedding
        ├── intelligence
        └── operation-flights

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

## External startup recovery order

The native repository deliberately starts after the represented Store has
recovered its journal. The current `externalFiles` table is then admitted through
the strict row validator; startup does not migrate or synthesize any field.
Finally, `externalFileStorage.reconcile` receives one hash/size/storage-id claim
per admitted row.

That order is the commit decision across the Store/filesystem boundary. A Store
transaction that reached durable journal commit owns its bytes even when the
request process stopped before finalizing the native claim. Reconciliation can
restore those bytes from a fsynced publication or garbage-quarantine artifact,
recreate missing row claims, and remove interrupted uncommitted publications and
true orphans. A represented row with no recoverable bytes fails startup instead
of being silently treated as available.

## Shutdown is one-way

`closeServerModel()` latches a flag as well as releasing the instance, and the
flag is the part that matters. Releasing alone would leave the accessor unable to
tell a request arriving mid-drain from one arriving before startup — and the
window is real: the Node adapter drains in-flight requests for up to thirty
seconds after the signal, and keep-alive connections keep delivering.

Shutdown releases what the graph holds: operation flights abort active provider
work and clear their deadlines, then observability closes its log stream. It is
idempotent: a second call does nothing, and no call after it revives the graph.

## Scoped accessors live on this root

Configuration and the logger are one per process and vary with nothing, so a
caller takes them off the graph `serverModel()` hands back.

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

## The entries

`start.server.ts` and `scope.server.ts`, and nothing else. Identity is an entry of
its own because `scope.server.ts` reaches the graph to read configuration —
folding it behind `start.server.ts` would mean the root re-exporting values from
a module that imports the root back out. It stays narrow: identity in, `Scope`
out, and no process object reachable through it.

`hooks.server.ts` builds the graph in its `init` hook and places the same
reference on each request's locals in `handle`. It does not construct a graph per
request, and `handle` does not await one.

## File tree

```text
server/
├── server.md
├── start.server.ts   buildServerModel, the one instance, and shutdown
├── types.ts          ServerModel
├── scope.server.ts   request identity
└── test/             lifetime and composition
```

The objects the graph is built from — `configuration`, `observability`, `store`,
`external-file-storage`, `embedding`, `intelligence`, and `operation-flights` — are
definitional and live in [`model/server/`](../../model/model.md). This tree calls
their constructors; it does not define them.

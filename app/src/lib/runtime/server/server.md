# The Server Model

`initialization.server.ts` owns the hook-lifetime startup command. SvelteKit may
call one cached hook's `init` again after invalidating its development Server;
those calls join the same promise. A re-evaluated hook creates a new command only
after the outgoing graph releases. The graph initializer itself still refuses
initialization of an already-built or closed graph. A failed startup remains
failed for that hook lifetime, with no request-time retry or fallback instance.

Vite's SvelteKit SSR runner does not expose a hot-module context to the hook.
Instead, `lifetime.server.ts` owns one branded listener on the process shutdown
channel. A new hook evaluation finds only that listener, removes it, and awaits
its release before initializing; adapter and subsystem listeners remain opaque.
`start.server.ts` injects the release and shutdown commands, so the helper never
holds or reaches into the graph. Repeated evaluations keep the listener count
constant, and a failed outgoing release prevents an overlapping graph.

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
| `buildServerModel` | the initializer, privately | a complete graph; pure composition |
| `create<Object>` | `buildServerModel`, once each | one fresh object |

```text
hooks.server.ts  init()          before the first request is answered
└── initServerModel()
    └── buildServerModel()
        ├── configuration
        ├── observability
        ├── store (journal recovery completes in construction)
        ├── external-file-storage
        ├── native reconciliation from Store-admitted External rows
        ├── embedding
        ├── intelligence
        └── operation-flights (Derived Output, Research and Agent task flights)
    └── resume current runner-owned Agent tasks

serverModel()                    every later caller
├── throw after shutdown begins
├── throw before init ran
└── otherwise the one graph
```

Construction tests exercise the private composition through `initServerModel`
with its leaves substituted. `serverModel()` is the only application accessor
for the published instance.

## Why the build happens in `init`

Not at module load: this module is imported by `hooks.server.ts`, and building at
import would make a configuration error a module-load failure with no logger to
report it.

Not on the first request either, which is what `init` buys. One build at a known
moment fails startup rather than one unlucky request. The composition root still
owns an explicit initialization promise: accidental concurrent calls join it,
completed initialization cannot replace the graph, and shutdown waits for an
in-flight build to release itself before it completes.

The accessor is therefore synchronous, and it distinguishes its two refusals: a
caller arriving during the drain hears "shutting down", and one arriving before
startup finished hears "not built". Collapsing them would report a defect and an
ordinary shutdown in the same words.

## External startup recovery order

The native repository deliberately starts after the represented Store has
recovered its journal and admitted every row against the one current schema.
Startup does not run a second capability-policy validator, migrate, or synthesize
any field. `externalFileStorage.reconcile` receives one hash/size/storage-id claim
per Store-admitted row.

That order is the commit decision across the Store/filesystem boundary. A Store
transaction that reached durable journal commit owns its bytes even when the
request process stopped before finalizing the native claim. Reconciliation can
restore those bytes from a fsynced publication or garbage-quarantine artifact,
recreate missing row claims, and remove interrupted uncommitted publications and
true orphans. A represented row with no recoverable bytes fails startup instead
of being silently treated as available.

Observability is the only acquired object at risk when Store recovery or native
reconciliation fails. The composition root closes it before rejecting startup,
so an invalid repository cannot strand a log stream or publish a partial graph.

After the graph is complete, initialization first validates every running Agent
task and its required current execution discriminator, then dispatches the whole
validated set. No plan signature or missing field is interpreted as a runner.
An activation failure closes the unpublished graph. Graceful shutdown leaves
runner-owned durable state running, drains its aborted process flight, and the
next initialized graph resumes it.

## Shutdown is one-way

`closeServerModel()` latches a flag as well as releasing the instance, and the
flag is the part that matters. Releasing alone would leave the accessor unable to
tell a request arriving mid-drain from one arriving before startup — and the
window is real: the Node adapter drains in-flight requests for up to thirty
seconds after the signal, and keep-alive connections keep delivering.

Shutdown releases what the graph holds: operation flights abort active provider
work, clear their deadlines, and drain the capabilities' terminal persistence;
only then does observability close its log stream. It is idempotent: a second
call joins the same drain, and no call after it revives the graph.

The development-only browser reset uses that same close boundary. Reset requests
are sequenced; each one aborts and drains the old graph before its disposable
Store directory is restored and a new graph is published. A terminal catch from
the old graph therefore cannot write into the next test's restored fixture. If
restoring or rebuilding fails after the old graph is released, the next
authorized reset may restore and rebuild from that explicit graphless state;
ordinary initialization and request access still cannot do so.

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

`start.server.ts` is the sole graph and lifecycle-state holder.
`initialization.server.ts` owns the startup command for one hook-module lifetime,
and `lifetime.server.ts` owns only generic process-listener identity and release
ordering. Identity has its own entry because `scope.server.ts` reaches the graph
to read configuration — folding it behind `start.server.ts` would make the root
re-export values from a module that imports the root back out. It stays narrow:
identity in, `Scope` out, and no process object reachable through it.

`hooks.server.ts` builds the graph in its `init` hook and places the same
reference on each request's locals in `handle`. It does not construct a graph per
request, and `handle` does not await one.

## File tree

```text
server/
├── server.md
├── start.server.ts   buildServerModel, the one instance, and shutdown
├── initialization.server.ts  one startup command per hook-module lifetime
├── lifetime.server.ts  process listener ownership and transition ordering
├── types.ts          ServerModel
├── scope.server.ts   request identity
└── test/             lifetime and composition
```

The objects the graph is built from — `configuration`, `observability`, `store`,
`external-file-storage`, `embedding`, `intelligence`, and `operation-flights` — are
definitional and live in [`model/server/`](../../model/model.md). This tree calls
their constructors; it does not define them.

# Pure islands and runtime binding contract

Status: proposed normative architecture contract for the `pure-functions` task.
It supersedes the prototype checker design on `work/pure-functions`; it does not
authorize product migration or integration by itself.

## 1. Purpose

Icarus will make three production code regions **pure islands**:

1. Every capability and every function below its capability directory.
2. Every model operation and every function below its `methods/` directory.
3. Every component procedure and every function below its `procedures/`
   directory.

These islands contain decisions and transformations. They do not acquire state,
identity, time, randomness, I/O, framework context, another island, or any other
authority. Everything they use is either defined inside the same island or is
received explicitly as owned data or a narrow port.

Runtime is the composition boundary. It creates model state, binds model state
to model adapters, acquires per-use model ports, transforms those ports into the
local vocabulary of one capability or component, authenticates and authorizes
remote calls, and releases every acquisition.

The intended result is stronger than a testability convention. The filesystem,
import graph, public types, runtime registry, and lifecycle runner must make it
difficult to express accidental hidden authority at all.

## 2. Normative language

The words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, and **MAY** are
normative.

- **Authority-pure** means that a function acquires no authority except through
  explicit parameters. It MAY deliberately read or mutate an explicit state
  parameter and MAY call observational or mutating functions on an explicit
  port. It is not necessarily referentially transparent in the mathematical
  sense.
- **Pure island** means a production source region whose complete direct and
  transitive dependency closure is governed by this contract.
- **State** means a model-owned singleton data structure. State has fields and
  no attached behavior.
- **Operation** means a free model function whose state, data, and effect ports
  are explicit parameters.
- **Model adapter** means the runtime-only facade around one singleton model
  state. It exposes acquisition and release, and optionally process shutdown. It
  is never passed to a capability, component procedure, or model operation.
- **Acquired model port** means the per-use callable interface produced by a
  model adapter. It exposes model operations plus `commit()`. It does not expose
  acquisition, release, shutdown, raw state, or other models.
- **Lease** means the runtime-owned use lifetime represented by one successful
  `acquire()` result. Every acquire produces a distinct lease facade, even when
  multiple facades delegate to the same concurrency-safe underlying resource.
- **Capability port** means a capability-owned local interface constructed by a
  runtime transformer from one or more acquired model ports.
- **Transformer** means a runtime file that translates runtime context and an
  explicitly declared set of acquired model ports into one capability's local
  context and ports.
- **Gateway** means the only remote wrapper. It resolves request authority,
  admits caller input, then delegates to the shared invocation runner.
- **Invocation runner** means the only production mechanism that acquires
  registry-declared model ports, transforms them, invokes an externally callable
  capability entry, commits successful work, and releases acquisitions. Remote
  and internal callers differ only in how runtime establishes their principal
  and scope grant before entering this runner.
- **Scope grant** means immutable server-derived evidence binding one
  authenticated principal to the exact authorized scope and authorization
  version/epoch for one invocation. It is not a client token and is never
  reconstructed from caller input.
- **Data-only** means a finite recursive value made from primitives, `null`,
  exact plain records, readonly arrays, and explicitly reviewed value containers
  such as copied bytes. It contains no function, accessor, unreviewed prototype,
  promise, iterator/stream, subscription, controller, port, singleton, or
  infrastructure handle. **Owned** means no mutable reference in that value is
  aliased to state on the other side of the boundary.
- **Owner home** means one capability directory, one model directory, or one
  component/category directory, depending on the island.

Tests, fixtures, generator implementations, architecture checkers, and runtime
adapters are not pure islands. Their production outputs and the boundaries they
construct remain governed.

## 3. Settled decisions

1. Capability production code has no import, export-from, dynamic-import, or
   require edge outside its own capability directory.
2. A capability does not import another capability, a model, representation
   code, runtime code, framework code, or an external package—not even as a
   type-only dependency.
3. Similar types in separate capabilities are separate local contracts. Runtime
   transformers translate between them explicitly.
4. Every production function anywhere below a capability is authority-pure,
   including entries, validators, helpers, and nested procedure steps.
5. Every production function anywhere below a model's `methods/` directory is
   authority-pure and imports only from the same model's pure files.
6. Every production function anywhere below a component's `procedures/`
   directory is authority-pure and imports only from that owner's declared pure
   files.
7. Model state is a singleton created by runtime and contains stored fields only.
   A stored field may be read directly, such as `runtime.body`. A derived read is
   a free operation, such as `getBody(runtime)`.
8. Each model owns one `port.ts` file containing its port types and the binding
   function that closes over the singleton state. A separate binding file is not
   required.
9. Runtime is the only caller that creates singleton model states and binds them
   to model adapters.
10. A model adapter exposes `acquire()` and `release()`. Runtime-only lifecycle
    such as `close()` MAY also exist. Nothing outside runtime receives this
    adapter.
11. `acquire()` returns the model's callable port plus `commit()`. It never
    returns `acquire()`, `release()`, `close()`, raw singleton state, or another
    adapter.
12. Runtime always releases successful, failed, and partially acquired work.
    Release never publishes staged changes.
13. The runtime runner automatically commits ordinary one-phase work only after
    the capability or procedure returns successfully. A capability or procedure
    MAY invoke its explicit commit port for a deliberate durable checkpoint.
14. Runtime owns the complete collection of model adapters. A capability
    transformer is invoked with only the statically declared subset it needs.
    It never receives the complete collection.
15. Every capability operation called by production code outside its owner has
    exactly one named runtime transformer, registry entry, and binding record. A
    remotely callable operation additionally has exactly one remote export. A
    private in-capability helper has none of those and remains inside its owner.
16. Authentication and project-scope resolution happen in the gateway. Resource
    ownership and domain authorization remain explicit in the capability and/or
    a project-bound capability port.
17. Remote caller input never establishes user identity, project membership, or
    ownership.
18. Component lifecycle effects are impure adapters and therefore move outside
    `procedures/`. They bind lifecycle to authority-pure procedures.
19. There are no checker suppressions, local exemption comments, compatibility
    aliases, or catch-all baseline entries for this contract. A migration branch
    may remain red until a slice is actually converted; integration requires the
    governed tree to be green.
20. Data arguments and results that cross a capability-port or acquired-model-
    port method are data-only. They cannot contain callbacks, live ports,
    subscriptions, streams, iterators, or other callable/lifetime-bearing
    values. An asynchronous method may wrap its one resolved data result in a
    promise owned by the current invocation. Flexible behavior is expressed as a
    closed local command type and a named operation, not as a callback or
    reflective dispatcher.
21. Pure-island asynchronous work is structured: every promise is awaited or
    returned through the current call chain. Detached work, floating promises,
    timer scheduling, and background callbacks are forbidden.

## 4. Target dependency flow

```text
browser event
  │
  ▼
runtime/remote/capabilities.remote.ts       static named remote export
  │
  ▼
runtime/server/capabilities/gateway.server.ts
  ├── authenticate the principal
  ├── resolve a server-owned scope grant through the authority resolver
  ├── call the capability-local admission function
  └── delegate to runtime/server/capabilities/invoke.server.ts
          ├── acquire the registry-declared model adapters
          ├── invoke the capability transformer
          ├── call the authority-pure capability
          ├── validate/encode the result
          ├── auto-commit on normal one-phase success
          └── release every acquisition in reverse order in finally
          │
          ▼
capabilities/<capability>/api/<operation>/<operation>.ts
          │ receives only local Context, Ports, and Input
          ▼
capability-local port methods
          │
          ▼
runtime/server/capabilities/adapters/<capability>.server.ts
          │ explicit member-by-member translation
          ▼
acquired model ports
          │
          ▼
model/<environment>/<model>/port.ts
          │ closes over one runtime-created singleton state
          ▼
model/<environment>/<model>/methods/<operation>.ts
          │ free function(state, explicit dependencies, input)
          ▼
model state and runtime-supplied infrastructure ports
```

The client-side equivalent replaces the remote gateway with a component
invocation adapter. The acquisition, successful auto-commit, and unconditional
release guarantees remain the same.

## 5. Target file architecture

### 5.1 Capabilities

```text
app/src/lib/capabilities/<capability>/
├── index.ts
├── api/
│   ├── <operation>/
│   │   ├── <operation>.ts
│   │   ├── admit-<operation>.ts
│   │   └── <operation-step>.ts
│   └── shared/                    capability-local consumers only
├── types/
│   ├── context.ts                capability-local server facts
│   ├── ports.ts                  capability-local required authority
│   ├── <operation>.ts            local input and result
│   └── <local-domain>.ts
└── test/
    ├── unit/
    ├── regression/
    └── non-functional/
```

Changes from the current tree:

- `index.remote.ts` leaves every capability directory.
- Imports from `$model`, `$runtime`, `$representation`, `$app`, `node:`, other
  capabilities, and packages disappear from capability production code.
- Capability tests MAY import test tools and runtime fixtures. Production files
  MAY NOT reach those tests, directly or transitively.
- `api/shared/` remains legal only for real consumers inside the same capability.
- `index.ts` is a pure outward entry for the runtime registry/transformer and
  tests. Product client code imports the generated central remote module, never a
  capability runtime value directly. Capability code cannot import back out.

Each operation entry exports one authority-pure function. Its conceptual shape
is:

```ts
export const renameProjectResource = (
  context: ProjectResourcesContext,
  ports: RenameProjectResourcePorts,
  input: RenameProjectResourceInput
): RenameProjectResourceResult => {
  // Decisions and explicit port calls only.
};
```

The context, ports, input, and result types are defined within this capability.
A remotely registered entry has exactly these three value parameters in this
order: `context`, `ports`, `input`. An unused category has the exact local type
`undefined`; it is not omitted, replaced with `{}`, or folded into another
category. An entry MUST NOT replace explicit categories with a bag, `unknown`,
`any`, an index signature, or a generic service container. Internal helpers may
use smaller explicit signatures.

### 5.2 Models

```text
app/src/lib/model/<client|server>/<model>/
├── index.ts                       public model types/constructors as governed
├── state.ts                       state type and state constructor
├── types.ts                       model-local data contracts
├── port.ts                        port types + bind<Model>()
├── methods/
│   ├── <operation>.ts
│   ├── <operation>/<operation>.ts
│   ├── <operation>/<step>.ts
│   └── shared/                    model-local pure consumers only
└── test/
```

`definition.ts` or `definition.svelte.ts` is replaced by `state.ts` as a model is
migrated. There is no compatibility re-export. Runtime construction changes in
the same slice.

The `methods/` island MAY import:

- Other production files under the same model's `methods/` tree.
- The same model's `state.ts` and pure `types.ts`.
- Same-model pure constants explicitly designated in the model layout.

It MUST NOT import `port.ts`, `index.ts`, tests, another model,
representation, runtime, capabilities, framework modules, Node/browser APIs, or
packages. The restriction is transitive.

`port.ts` is a boundary, not part of the methods pure island. It MAY import its
own model methods, state, and types and nothing outside its model directory. It
receives infrastructure dependencies as explicit structural arguments; it does
not import infrastructure implementations, discover runtime state, or create the
singleton at module load. Infrastructure implementations live under runtime,
not in a second model-owned adapter directory.

### 5.3 Runtime

```text
app/src/lib/runtime/
├── client/
│   ├── models/
│   │   ├── build.ts               create and bind client model adapters
│   │   └── types.ts               complete client adapter collection
│   ├── procedures/
│   │   └── invoke.ts              generic acquire/commit/release runner
│   └── start.ts
├── server/
│   ├── models/
│   │   ├── build.server.ts        create and bind server model adapters
│   │   ├── types.ts               complete server adapter collection
│   │   └── lifetime.server.ts
│   ├── capabilities/
│   │   ├── gateway.server.ts      remote auth/scope/admit → shared runner
│   │   ├── invoke.server.ts       sole shared capability lifecycle runner
│   │   ├── internal.server.ts     static job/system authority entry
│   │   ├── registry.server.ts     static complete registry
│   │   ├── types.ts
│   │   └── adapters/
│   │       ├── <capability>.server.ts
│   │       └── ...
│   ├── authority/
│   │   ├── authenticate.server.ts  request → authenticated principal
│   │   ├── resolve-scope.server.ts principal + route target → scope grant
│   │   └── types.ts                server-only authority contracts
│   ├── infrastructure/            process, provider, Node and storage bindings
│   ├── initialization.server.ts
│   └── lifetime.server.ts
└── remote/
    └── capabilities.remote.ts     generated remote exports only
```

The exact consolidation of existing runtime files may be staged, but the final
ownership boundaries are normative:

- Model creation and singleton ownership are under runtime model construction.
- Model-specific `bind<Model>()` implementations remain in each model's
  `port.ts`; runtime is their only production caller.
- Runtime infrastructure modules import external packages and construct the
  low-level interfaces supplied to model bindings.
- Capability transformers MAY import reviewed deterministic schema/codec/data-
  conversion packages when structural translation genuinely requires them.
  Their exact package/member dependencies appear in the binding record. Provider,
  filesystem, network, clock, random, or other effectful packages live only in
  runtime infrastructure and cannot be called by a transformer.
- Runtime authority modules own session verification and scope lookup. If scope
  lookup needs a model, they receive/acquire one exact authority port through
  runtime construction and release it before capability execution; they never
  reach the complete model collection or pass that authority port onward.
- Capability transformers live under runtime, one file per capability by
  default. A small-file consolidation requires multiple capability entries to
  have the same owner and lifecycle; it is not a generic miscellaneous file.
- The remote module exports only SvelteKit remote functions. The registry,
  transformers, gateway, and model adapters are server-only imports and are not
  runtime exports from the remote module.

### 5.4 Component owners

For an app-view category or surface owner:

```text
<owner>/
├── components/                    rendering helpers
├── content|context|inspector/     rendered views
├── types/                         owner-local pure contracts
├── procedures/                    authority-pure island
│   ├── <procedure>.ts
│   ├── <procedure>/<procedure>.ts
│   ├── <procedure>/<step>.ts
│   └── shared/
├── adapters/                      remote/model/browser transformations
└── effects/                       lifecycle registration and cleanup
```

Current `procedures/effects/` files move to the owner's `effects/` boundary.
Effects are intentionally impure and cannot be descendants of the pure
`procedures/` island.

Procedure production code MAY import only `procedures/` and explicitly pure
`types/` files owned by the same component/category/surface. It MUST NOT import
markup, components, adapters, effects, runtime, models, capabilities,
representation, browser/framework APIs, another owner, or packages.

An adapter or effect MAY call a procedure, but a procedure cannot call back into
an adapter or effect.

Component markup remains composition/wiring. An event handler may copy explicit
event fields into owner-local data and make one named adapter/runner invocation.
It may not contain domain branching, loops, multi-step mutation, remote/model
calls, or move a procedure body inline. Framework-required view assignment is
delegated to a named procedure when it contains a decision or transformation.

## 6. Pure-island language contract

Import closure alone is not purity. Every production file in a pure island also
obeys the following source contract.

Governed executable sources use ordinary TypeScript `.ts` modules. JavaScript,
JSX/TSX, `.svelte`/`.svelte.ts`, ambient `.d.ts` shims, and other compiler/plugin
languages are not alternate ways to implement an island function. Static data is
expressed as a deeply immutable TypeScript literal; non-TypeScript asset/data
imports are forbidden.

### 6.1 Allowed

- Free function declarations and arrow functions.
- Local immutable bindings.
- Local mutable data allocated during the current invocation.
- Reads and writes rooted in explicit parameters.
- Calls to functions defined in the same pure island.
- Calls to methods on explicit port parameters.
- Deterministic language intrinsics from a reviewed allowlist, such as primitive
  conversion, arrays, records, `JSON`, and regular expressions.
- `throw` with locally constructed error data or an allowed deterministic error
  value.
- Async functions when every awaited value originates in an explicit port or a
  local pure function.

The intrinsic allowlist is member-specific, not object-wide: allowing
`Math.abs`, for example, does not allow `Math.random`. Stateful intrinsics such
as a global/sticky regular expression are allocated inside the invocation rather
than retained at module scope.

Ports are opaque callable surfaces. Pure code may select a statically declared
port-member path and invoke or locally extract that member. It may not enumerate
the port, inspect descriptors/prototypes, access properties of the function
value, or use `call`, `apply`, `bind`, `constructor`, `toString`, or another
Function/Object prototype escape.

### 6.2 Forbidden

- `this`, classes with runtime behavior, getters, setters, decorators, or
  prototype mutation.
- Runtime-value imports outside the island.
- Type-only imports outside the island.
- Ambient/project-global authority types, DOM/Node/framework types, `typeof`
  queries of ambient values, import-type expressions, triple-slash references,
  or local aliases/interfaces that extend or wrap any such type. Pure-island
  types resolve to owner files or a reviewed member-specific TypeScript standard-
  library type allowlist only.
- `declare global`, ambient module/namespace declarations, module augmentation,
  or declaration merging with a symbol outside the island.
- Type/lint/checker suppression pragmas such as `@ts-ignore`, `@ts-expect-error`,
  `@ts-nocheck`, lint-disable comments, coverage-ignore directives around
  governed branches, or file-local architecture exemptions.
- Re-exports from outside the island.
- Dynamic `import()`, `require`, `eval`, `Function`, WebAssembly loading, or
  user-selectable module names, `import.meta`, or triple-slash loading.
- `globalThis`, `window`, `document`, `navigator`, storage globals, process or
  environment access, framework request context, console, network APIs, provider
  SDKs, filesystem APIs, timers, clocks, randomness, locale-sensitive ambient
  state, `Atomics`, `SharedArrayBuffer`, `WeakRef`, `FinalizationRegistry`, or
  Svelte runes.
- Reading a singleton through an accessor, registry, module variable, symbol,
  prototype, global cache, or closure created outside the current call.
- Mutable module state, including mutated `const` arrays/maps/sets and lazy
  initialization.
- Mutation of imported values or captured module values.
- Port acquisition, release, process shutdown, or model construction.
- Type assertions other than a checker-reviewed `as const` literal narrowing.
  Double assertions, non-null assertions at a boundary, `any`, and unchecked
  generic casts are prohibited.
- `Proxy`, `Reflect`-based indirection, `Object.defineProperty`, accessors, symbol
  keys, computed service names, object rest over a service object, or object
  spread from a service/model/port object.
- Broad authority containers: `any`, `unknown`, `object`, `Function`, index
  signatures, arbitrary records, or unconstrained generics in any pure-island
  function parameter/result or data/port surface. `unknown` is permitted only in
  the statically designated local input-admission subgraph, or as a catch binding
  that is immediately rethrown without classification. Its provenance must be
  raw transport/caught data, never a port, and it must not cross into the admitted
  operation. A
  generic is allowed only when constrained to an explicit local data-only type
  and proven unable to accept or return a port/callable.
- Promise construction, floating promises, `void`-discarded promises, detached
  async callbacks, generators, async iterators/streams, or any work that may
  continue after the current entry returns.
- Callable values in data arguments/results crossing a capability or acquired
  model port, including predicates, transaction callbacks, cleanup functions,
  subscriptions, and callback-bearing option objects.

### 6.3 Owned data

Capability admission functions MUST convert raw input into capability-owned
data. They reject accessors, unreviewed prototypes, symbol/non-enumerable keys,
functions, unexpected fields, and stale shapes. A reviewed transport value such
as bytes is copied into the capability's local representation. Admission does not
return a caller-owned object reference merely because its visible fields appear
valid.

Context, input, and result are data-only. Only the declared `ports` category may
contain callables. A result cannot contain or retain a port, promise, iterator,
stream, subscription, cleanup callback, abort controller, or other live handle.
Authority facts such as the authenticated caller, active project, membership,
role, and granted scope originate only in gateway-created context. A same-named
caller input field is ordinary untrusted data and MUST NOT be used as proof of
authority.

Runtime transformers MUST likewise prevent a model's live state objects from
escaping under a capability-local structural type. Read ports return immutable
snapshots or newly owned local data. Mutation ports accept capability-local data
and translate it before invoking a model port.

A port call consumes or copies its data arguments before the synchronous return
or awaited promise resolves. It cannot retain a caller-owned mutable reference
for later background work. Staged operations copy accepted data into the lease's
owned stage; immediate operations explicitly own any queued durable record before
returning. This makes “await every port call” a real lifetime boundary rather
than a promise that resolves while borrowed data/authority is still retained.

This requirement prevents structural typing from turning a type-local boundary
into a shared-object boundary.

## 7. Model state and operation contract

### 7.1 State

A model state type contains data fields only:

```ts
export type SpreadsheetRuntimeState = {
  body: SpreadsheetBody;
  revision: number;
  pending: readonly SpreadsheetChange[];
};
```

The following are forbidden on state:

- Method or call signatures.
- Function-valued properties.
- Getters or setters.
- Lazy accessors.
- A reference to its own adapter or acquired port.
- A reference to the complete runtime/model collection.
- A generic/nested service container, callback registry, or undeclared authority
  disguised behind a broad data field.

State construction is an explicit exported function called only by runtime. No
state exists at module load. A state constructor may validate configuration but
does not acquire process globals; runtime passes its inputs.

Arrays, maps, sets, typed arrays, and other reviewed data containers MAY be state
fields. A model-owned resource whose lifetime is itself model state—such as an
explicitly typed abort controller held by a flight model—MAY also be a field;
calls on it remain visibly rooted in the explicit state parameter. Its exact
model-local structural type and lifetime are declared, and it cannot be a general
runtime/service locator.

Shared external infrastructure such as a database connection, provider SDK, or
filesystem implementation is instead an explicit `bind<Model>()` dependency.
Runtime creates it once when appropriate; the binding may delegate many distinct
lease facades to that concurrency-safe core without cloning the connection. It
supplies operations only the narrow model-local interface they need.

### 7.2 Operations

Every public or supporting operation is a free function. When it operates on
model state, that state is its first value parameter:

```ts
export const getBody = (
  runtime: SpreadsheetRuntimeState
): SpreadsheetBody => runtime.body;

export const apply = (
  runtime: SpreadsheetRuntimeState,
  changes: readonly SpreadsheetChange[]
): void => {
  runtime.pending = [...runtime.pending, ...changes];
};
```

An operation that requires I/O receives a model-local infrastructure interface
explicitly. It does not import the implementation. Supporting operations and
callbacks obey the same rule; nesting does not create an exemption.

Public model-port operations accept and return model-owned data. They do not
accept callbacks or expose generic transaction functions. A need such as
“perform these changes atomically” becomes one named model operation accepting a
closed command value; it is not `transaction(work)` with caller-provided code.

### 7.3 Port and adapter

Each model's `port.ts` defines the callable surface and binding in one place:

```ts
export type AcquiredPort<Operations extends object> = Readonly<Operations> & {
  commit(): void | Promise<void>;
};

export type ModelAdapter<Operations extends object> = {
  readonly lifetime: "server-process" | "client-workspace";
  readonly commitMode: "staged" | "immediate" | "read-only";
  acquire(context: ModelUseContext):
    | AcquiredPort<Operations>
    | Promise<AcquiredPort<Operations>>;
  release(port: AcquiredPort<Operations>): void | Promise<void>;
  close?(): void | Promise<void>;
};

export type StoreOperations = {
  readProjectResource(query: ReadProjectResource): ProjectResourceSnapshot;
  stageProjectRevision(command: StageProjectRevision): void;
};

export const bindStore = (
  state: StoreState,
  files: StoreFiles
): ModelAdapter<StoreOperations> => {
  // The implementation chooses isolation and concurrency strategy.
};
```

The illustrative shared types above may be duplicated per model rather than
imported from a general runtime package. Runtime relies on structural
compatibility and explicit construction.

Every model declares one runtime lifetime literal in `port.ts`. Server models are
constructed once per server process graph; client models once per client
workspace runtime. Component-local transient data is explicit component state,
not a new global model lifetime hidden in a module.

The outer adapter is runtime-only. The acquired port is consumer-facing. The
acquired port has exactly the declared enumerable own operations plus `commit()`.
Its prototype is exactly `Object.prototype` or `null`; it has no custom inherited
authority, symbol, accessor, or non-enumerable members.

Each successful `acquire()` returns a newly allocated, frozen lease facade. An
implementation MAY delegate those facades to one shared concurrency-safe core,
but release invalidates only the matching lease. Every operation closure,
including a previously extracted function reference, checks that lease's state
before delegating. Releasing one acquisition cannot invalidate or authorize any
other acquisition.

Model-port members are named domain operations. Reflective dispatch such as
`execute(name, payload)`, arbitrary method/table/path selectors, unconstrained
command envelopes, and generic service-container access are forbidden. A closed
discriminated command union is permitted only when that union itself is the
model's intentional domain operation and every variant is statically declared.

`port.ts` owns only binding and the acquire/guard/commit/release/close state
machine. Every ordinary acquired-port operation is an explicit one-call wrapper
around one statically named free function in `methods/`, supplying the singleton
state, the exact binding dependency subset, lease-local stage, and caller data as
declared. Substantive snapshot, validation, mutation, conflict, commit, recovery,
or cleanup algorithms are free model functions in the governed method closure;
they cannot be moved inline into `port.ts` or runtime infrastructure. The port
may branch only on lifecycle state/mode and delegate those named algorithms.

## 8. Acquire, commit, and release

### 8.1 Required state machine

```text
unacquired
    │ acquire
    ▼
open stage ── operation ──► open stage
    │                           │
    │ commit                    │ commit
    ▼                           ▼
committed checkpoint ─────► fresh open stage
    │
    │ release
    ▼
released
```

Failure states:

```text
acquire failure              capability is not invoked; earlier acquisitions release
operation failure            no automatic commit; release discards an open staged epoch
commit refusal/conflict      commit throws; port becomes failed until release
commit storage fault         fault propagates; release runs; durable recovery semantics apply
release failure              reported as a lifecycle fault and never replaces an earlier fault
use after release            throws deterministically
```

### 8.2 Acquire

`acquire()` MAY:

- Return a distinct lease facade that delegates to a shared immutable or
  concurrency-safe core.
- Allocate an isolated copy-on-write stage.
- Lease a database connection or transaction.
- Acquire a mutex or sequence number.
- Capture a model revision for optimistic concurrency.
- Allocate a request-local counter, controller, or other use-lifetime state.

It MUST NOT expose which strategy it selected through undeclared properties. It
MUST NOT make uncommitted staged mutations visible to a separate acquisition
when the model declares staged semantics.

The acquisition context contains only gateway/runtime-derived identity, scope,
cancellation, and lifetime data. Caller input is never forwarded into
`acquire()` as authority. The capability/procedure runner acquires each declared
model at most once in its execution phase and shares that one acquired facade
with the invocation's transformer.
If `acquire()` allocates a partial resource and then throws before returning a
port, that model cleans up the partial resource internally because the runner has
no acquired value it can release.

### 8.3 Commit

Every acquired port exposes `commit()`, even if the model is read-only or its
underlying service is already safely immediate.

The model documents one of three commit modes in `port.ts`:

| Mode | Operation behavior | `commit()` | `release()` |
| --- | --- | --- | --- |
| `staged` | Mutators change acquisition-local state | Atomically publishes the current epoch and starts a fresh epoch | Discards the current uncommitted epoch |
| `immediate` | Explicit port calls may perform irreversible external effects | Confirms/checkpoints or is a documented no-op | Releases resources; cannot promise rollback |
| `read-only` | No mutation operations exist | No-op | Releases resources |

For staged models:

- A successful commit publishes all and only the current epoch.
- A failed commit publishes no pre-decision partial state. If the durable commit
  decision was already made, recovery completes that decision; it is not called
  a rollback.
- After a successful commit, later operations belong to a new epoch. This allows
  a deliberate durable checkpoint before external work.
- Committing an empty fresh epoch is a successful no-op. Consequently, an
  explicit checkpoint followed by ordinary successful return does not republish
  or increment an empty revision when the runner performs its final auto-commit.
- After a conflict or commit fault, further operations and commits fail until
  release.

The runtime invocation runner automatically commits every ordinary staged
acquisition after the pure entry returns successfully. Therefore ordinary
capabilities and procedures do not need commit ceremony.

“Returns successfully” is a control-flow statement, not inspection of a local
result shape. A normal return votes to commit its staged epoch; a throw,
cancellation, admission failure, or invalid result votes to abort. A normal
domain-refusal result therefore MUST leave no unwanted staged changes; model
operations that can refuse are failure-atomic and return typed local refusal data
rather than throwing. If earlier work must be discarded, the capability must
reorder the decision or call one named atomic model operation. The gateway never
classifies thrown values by fields such as `ok`, `success`, `kind`, or message:
every throw remains an operational fault and aborts the open epoch.

A pure entry calls an explicitly supplied `commit()` only when it deliberately
needs a durable checkpoint before continuing. Such a checkpoint is an
irreversible business decision and requires a focused durable-work test. If a
later step fails, the earlier checkpoint remains committed and must be completed,
retried from durable state, or compensated explicitly.

### 8.4 Release

Runtime calls `release()` exactly once for every successful acquisition and does
so in reverse acquisition order inside `finally`.

Release:

- Never commits or publishes a pending stage.
- Is safe after operation or commit failure.
- Invalidates the acquired port.
- Releases locks, connections, snapshots, timers, or request-local state.
- Is idempotent defensively, although the runner still calls it once.
- Accepts only a lease produced by that exact adapter. A forged, copied, or
  different-model/different-adapter port is rejected and cannot release another
  lease.
- Does not erase or disguise the primary operation/commit fault. A release fault
  is attached or reported separately.

Cancellation and transport disconnects follow the same failure path: no
automatic staged commit occurs merely because cancellation happened, and every
returned acquisition is released. The gateway may pass cancellation as an
explicit runtime/model signal, but the raw request event or abort controller does
not enter a pure island.

Capabilities, component procedures, model operations, and capability-local
helpers cannot name or call `release()`.

If an outer adapter exposes `close()`, runtime calls it during shutdown in
reverse model-construction order. Close is idempotent, prevents new acquisition,
and either waits for or explicitly cancels then waits for every active lease
according to that model's documented shutdown contract. It never silently
abandons an active staged epoch or detached task.

### 8.5 Multiple models

The registry declares model dependencies in a canonical global order. Runtime
acquires them in that order and releases them in reverse. A transformer does not
perform ad hoc acquisition. Duplicate model names are rejected; there is one
lease per named model per invocation.

Sequential commits to two independent staged models are not atomic. Therefore:

- An ordinary atomic intent MUST have exactly one staged commit owner.
- Supporting data that belongs to that intent must participate in the owning
  model's unit of work.
- A true multi-model atomic requirement needs an explicit composite model or
  transaction coordinator with one commit decision.
- A staged model plus an immediate external service uses a durable job/outbox,
  idempotent operation, or explicit compensation. It cannot be described as one
  atomic commit.

## 9. Capability transformers

Each capability has one runtime transformer file by default:

```text
runtime/server/capabilities/adapters/<capability>.server.ts
```

The static registry declares exactly which model adapters each operation needs.
The gateway selects and acquires that subset before invoking the transformer.
Although runtime owns the complete collection, the transformer does not receive
it as a service locator.

Illustrative shape:

```ts
export const submitSpreadsheetChangesAdapter = {
  models: ["store"] as const,
  codecs: [] as const,
  bindings: {
    "sheets.read": ["store", "readSheet"],
    "sheets.stageRevision": ["store", "stageSpreadsheetRevision"],
    "sheets.commit": ["store", "commit"]
  } as const,

  context(scope: RuntimeProjectScope): SpreadsheetContext {
    return {
      projectId: scope.projectId,
      userId: scope.userId,
      startedAt: scope.startedAt
    };
  },

  ports(models: { store: AcquiredStorePort }): SpreadsheetPorts {
    return {
      sheets: {
        read: (id) => toCapabilitySheet(models.store.readSheet(id)),
        stageRevision: (change) => models.store.stageSpreadsheetRevision(change),
        commit: () => models.store.commit()
      }
    } satisfies SpreadsheetPorts;
  }
};
```

Transformer guarantees:

- The `models` declaration is a literal, sorted, duplicate-free dependency list.
- The transformer parameter contains exactly that acquired subset.
- Context is copied member by member into capability-local plain data.
- Ports are constructed member by member and checked with `satisfies`.
- `as`, double assertions, object spread, object rest, computed model names,
  getters, proxies, descriptor tricks, and prototype inheritance are forbidden.
- Returned closures may reference only the declared acquired ports and local
  immutable translator functions or binding-record-declared deterministic codec
  members. They cannot capture the full model collection, runtime request event,
  registry, or adapter.
- The transformer imports model **types** needed to describe its explicit
  parameters, but it cannot import a model builder, singleton accessor, adapter
  instance, registry accessor, or infrastructure implementation. Its acquired
  values arrive only through its parameter.
- Read results are translated to owned immutable capability data; live model
  state references do not escape.
- A capability-local commit method delegates only to the corresponding acquired
  port's commit.
- The transformer does not contain capability decisions or model mutation
  algorithms. It translates and binds.

“Translates and binds” is a deliberately narrow grammar. A transformer MAY:

- Destructure its explicit scope/acquired-port parameters.
- Construct capability-local plain objects member by member.
- Define stateless data translators whose bodies only construct local data,
  rename fields, map closed collections, and convert reviewed primitives.
- Call a binding-record-declared deterministic codec/converter on owned data.
- Define a capability-port closure whose body performs exactly one statically
  named acquired-port call, with arguments produced by those translators, and
  translates that call's result.

A transformer MUST NOT contain domain branching, loops other than a direct
collection mapping in a data translator, retries, catches, mutation algorithms,
authorization decisions, arbitrary callback execution, or a call to another
runtime service/effectful package. Every capability-port member has a generated
declarative binding record naming its acquired model and statically named model-
port member.
The checker compares the record to the closure AST; focused adapter tests pass
distinct sentinel values through every member so a same-shaped but incorrect
method binding fails behaviorally.

Every non-primitive translated result is freshly constructed recursively. An
identity return of a model-owned object, shallow wrapper around a live nested
object, or collection whose elements remain model-owned is forbidden even when
the local and model types are structurally identical.

Capability-port objects and nested port groups are frozen before invocation.
Port method arguments and results are data-only; methods cannot accept a
callback, return another port/live handle, or expose an async stream. One promise
resolving to owned data is allowed and must be awaited/returned. Project-
bound members close over the gateway-resolved project and do not accept a caller-
selectable project or user identity as an authorization parameter.

## 10. Registry and remote gateway

### 10.1 Registry

`runtime/server/capabilities/registry.server.ts` is the canonical tracked static
manifest. The capability generator is its only supported writer. Registration
does not happen through module-load side effects, filesystem scanning at server
startup, decorators, or mutable calls.

Every production operation callable from outside its capability has one entry
declaring:

- Stable operation name.
- Owning capability.
- Invocation kind: query, command, form, prerender, or internal.
- Scope policy: project, session, or public.
- Capability-local admission function.
- Authority-pure capability entry.
- Runtime transformer.
- Exact model dependency list.
- Commit policy: automatic one-phase or explicitly checkpointed.

One capability adapter module MAY export several named operation transformers,
but each operation has exactly one transformer definition and one binding record.
The registry's dependency list must equal that transformer's literal list. Model
commit modes are static literal metadata on the runtime-only outer adapters, so
registry validation can reject two staged owners before serving requests.

Project scope is the default. Session/public entries are explicit exceptions in
the registry and require focused authority tests; they are not checker comments.

An internal entry is invoked through the same lifecycle runner with a static
registry reference and an explicit runtime-issued principal/scope grant. A
scheduled job, hook, startup task, or another runtime module cannot import and
call a capability entry directly or invent an unscoped “system” caller. A system
principal/scope is a distinct reviewed registry policy, not a magic user ID.

The registry is constructed as a deeply frozen literal, contains no mutable
state, and exposes no generic lookup to product code. User-controlled strings
cannot select a capability, transformer, model, method, or module.

### 10.2 Gateway order

The gateway performs these steps in order:

1. Locate the statically registered operation from the generated wrapper, never
   from user input.
2. Authenticate the principal through the dedicated runtime authority boundary.
3. Resolve the declared scope policy through the authority resolver. For project
   scope, map the user's route token to a project within that principal's current
   memberships and produce an immutable scope grant/version. Any short-lived
   authority-model acquisition is released before continuing.
4. Invoke the capability's local admission function on raw caller input.
5. Select the registry-declared model adapters.
6. Acquire them in canonical order. On partial failure, release successful prior
   acquisitions in reverse.
7. Construct capability-local context and ports through the transformer.
8. Invoke the capability entry.
9. Validate and fully encode the returned capability-owned data into its
   transport-safe representation while the stage is still abortable.
10. On normal one-phase success, auto-commit the one staged commit owner. Do not
    auto-commit after an entry or result-encoding fault.
11. Release every acquisition in reverse order in `finally`.
12. Return the already encoded result to the remote framework.

`internal.server.ts` substitutes a static registry reference and reviewed runtime-
issued principal/scope policy for steps 1–3, admits its persisted/internal input,
then delegates to the same steps 5–11 in `invoke.server.ts`. It has no alternate
acquisition, commit, or release implementation.

If step 8 throws, the gateway records the original value, skips steps 9–10, and
still runs step 11. The thrown value is the primary operational fault, is not
classified by shape/message, and is not exposed verbatim to the caller.

The raw request payload is supplied only to admission. It is never merged into
the authenticated context, acquisition context, or model dependency selection.
The gateway validates/encodes the returned capability-owned data before commit
and before crossing the transport boundary; it never serializes a live value
opportunistically.

“Select” constructs a fresh, frozen, exact subset object member by member. It
does not pass the complete adapter/acquired collection under a narrower
TypeScript annotation, use object rest/spread, or rely on excess-property
checking. The transformer therefore cannot recover an undeclared model at
runtime even if its source types are later weakened.

The runner records whether its one staged owner has already checkpointed. A
normal-return auto-commit still invokes that owner's `commit()`; an empty epoch is
the required no-op described in section 8.3. Read-only and immediate acquired
ports are not auto-committed merely for symmetry. If their explicit `commit()`
has meaning, the capability must expose and call that checkpoint deliberately and
the registry must use the checkpointed policy.

Capability-model `acquire()` receives the resolved scope grant, not the raw
request or route token. This is a distinct capability-execution acquisition
phase: if the authority resolver is backed by the same underlying model, its
already-released read lease is not reused or exposed. Each project-bound read and
each authorization-sensitive staged commit verifies that the grant is still
valid for the target scope, using the owning model's atomic/revision mechanism.
This prevents a membership-revocation race between gateway preflight and the
actual read or durable mutation.

A commit may have durably succeeded even if final framework transport or caller
acknowledgement subsequently fails; pre-encoding cannot prevent a disconnect.
The gateway does not blindly retry an ambiguously acknowledged command.
Idempotency or request keys belong to the capability contract where needed.

### 10.3 Authorization

The gateway proves authentication and coarse scope. It does not assume that a
client-supplied resource ID belongs to that scope.

The authority resolver is an explicit runtime dependency with its own narrow
interface and lifecycle; “server-owned request state” is not permission to read
an ambient singleton. It returns only the minimal scope grant. It cannot be
imported by capability code or included in capability ports.

Only the authority boundary constructs a valid scope grant in production. A
plain structural lookalike made by another runtime module does not validate at a
project-bound model boundary. The transformer's capability context receives only
the minimal copied facts a capability may reason about, never the opaque grant
proof/version mechanism itself.

Capability ports SHOULD be project-bound so they cannot ask for arbitrary
projects. The capability still checks operation-specific ownership and domain
conditions where a target can be absent, shared, linked, or otherwise nuanced.
Unauthorized targets are not disclosed through distinguishable lookup behavior.

For project-scoped operations, project binding is REQUIRED unless the focused
contract explicitly represents an authorized cross-project operation. Such an
operation receives both authorized scopes from gateway context; it never obtains
a general “all projects” port. Top-level `userId`, `projectId`, role, membership,
or scope fields in caller input cannot satisfy or override these facts.

### 10.4 Remote export

`runtime/remote/capabilities.remote.ts` contains static named remote values only.
It does not export a registry, model, gateway helper, transformer, or ordinary
function at runtime.

Client code imports remote operations from this one governed boundary. No other
production `.remote.ts` file exists after migration. The generator adds/removes
the registry entry and remote named export together.

## 11. Component procedures and effects

### 11.1 Procedures

Every production file below an owner's `procedures/` is in the pure island. This
includes nested steps, `shared/`, formatters, predicates, and callbacks.

Procedures:

- Receive owner-local component state/data and every callable port explicitly.
- May mutate explicitly received owner-local component state or call explicit
  ports. Raw model singleton state is never a procedure parameter; model
  authority arrives through an acquired/adapted port.
- Import only same-owner pure procedure/type files.
- Contain no lifecycle registration, Svelte rune, browser access, remote import,
  model accessor, timer, clock, random source, or module state.
- Do not return a live adapter/model object or store an explicit port in module
  state.
- Await or return every asynchronous port call; they cannot start work whose
  lifetime exceeds the procedure invocation.

### 11.2 Component adapters

Owner-local `adapters/` files may import acquired client-model port types, the
central client-visible remote facade, and browser/framework bindings. Server
gateway and complete model-adapter collections remain inaccessible to component
code. Owner adapters translate their explicit inputs into exact owner-local
procedure ports.

The same exact-construction rules apply: no whole runtime/model spread, no cast,
no hidden members, no getters/proxies, and no live state masquerading as a local
data shape.

A standard client invocation runner owns model acquisition:

```text
event → acquire declared client model ports → adapt → procedure
      → auto-commit on success → release in finally
```

The component wires the event to this runner; it does not reproduce lifecycle
logic inline.

### 11.3 Effects

Effects live in `effects/`, not `procedures/effects/`.

An effect:

- Registers one lifecycle synchronization concern.
- Acquires ports through the owner adapter or invokes the standard runner.
- Calls one or more authority-pure procedures for substantive decisions.
- Captures the tab/resource/component identity at acquisition time.
- Cleans up listeners, timers, subscriptions, and long-lived acquisitions.
- Does not become a miscellaneous behavior module.

A staged model lease is invocation-scoped and is never held for the component's
lifetime. An effect that needs a long-lived framework subscription owns that
impure handle entirely in its adapter/effect boundary, passes only data events
into fresh governed procedure invocations, and releases the handle during
cleanup. The subscription/cleanup handle never becomes a procedure port result.

An effect that only bridges a framework signal to cleanup need not invent a
meaningless procedure. A checker enforces that any substantive branching,
transformation, or mutation is delegated, rather than requiring a ceremonial
one-to-one procedure call.

The effect grammar is structural, not a subjective code-review exception. An
effect may register/unregister framework callbacks, capture immutable identity,
hold local cleanup handles, and invoke a named adapter/runner/procedure. It may
not contain loops, switches, domain-state assignment, data mapping, catches that
change domain outcomes, or inline mutator chains. A required conditional calls a
named pure predicate/procedure for the decision; the effect only selects whether
to register, invoke, or clean up. Cleanup handles never enter procedure data.

## 12. Checker contract

The checker suite is positive and structural first. Name blacklists remain a
secondary defense for ambient language authority.

The implementation uses five reinforcing layers:

1. **Filesystem discovery and resolved dependency closure** establish every
   governed source and where every import/re-export/load edge actually lands.
2. **TypeScript symbol and lexical provenance analysis** classifies every value
   used by a pure function as parameter-rooted, invocation-local, immutable
   island definition, module state, or ambient authority.
3. **Boundary-shape analysis** verifies state, lease, port, transformer, input,
   result, and effect syntax using resolved types plus runtime descriptor tests.
4. **Generated graph comparison** proves operation/transformer/binding/registry/
   remote completeness and prevents a second hand-maintained exposure path.
5. **Mutation and behavioral contracts** cover lifecycle, routing, durability,
   concurrency, ownership, and JavaScript runtime shapes that static typing
   cannot prove.

The checkers share one repository program/configuration resolver and one owner-
zone catalog. They do not each guess aliases, extensions, generated roots, or
production/test status independently. An unsupported syntax form or unresolved
provenance at a governed boundary fails closed with a precise diagnostic until
the checker deliberately learns it.

### PF-01: `pure-island-import-closure`

Scope: all production files in every capability, model-method, and component-
procedure pure island.

Guarantee:

- Every static import, type import, export-from, and transitive dependency
  resolves inside the exact allowed island/home.
- Every non-primitive referenced type resolves to an allowed owner file or the
  reviewed standard-library type allowlist; import-type nodes, triple-slash
  references, and ambient/global declarations cannot bypass the file graph.
- Capability closure never leaves its capability.
- Model-method closure reaches only same-model methods/state/types designated
  pure, never `port.ts` or `adapters/`.
- Component-procedure closure reaches only same-owner procedures/types designated
  pure, never adapters/effects/markup.
- Discovery starts from filesystem ownership, not a maintained list of “known
  pure files.” Every supported production TypeScript, JavaScript, Svelte module,
  generated source, and executable extension below a governed directory is
  included. An unrecognized executable source extension fails closed.
- After discovery, reject governed executable implementations that are not
  ordinary `.ts` modules; discovery of JavaScript/Svelte/plugin-language sources
  is for fail-closed enforcement, not an exemption from the language contract.
  Generated ordinary TypeScript remains fully governed.

Implementation requirements:

- Resolve aliases, relative paths, extension/index resolution, and package
  exports using the repository's actual TypeScript/Svelte configuration.
- Resolve every edge transitively, including re-export barrels.
- Reject unresolved edges rather than assuming they are safe.
- Reject symlinks whose real path leaves the allowed root.
- Treat package and Node imports as outside.
- Reject production-to-test/fixture/script edges and test-to-production re-export
  tricks even when both paths are beneath the owner home.
- Report the complete shortest path from island source to escaping dependency.

Mutation proofs include direct import, type-only import, export-from, one-hop and
two-hop laundering, alias laundering, relative traversal, package import,
dynamic import, require, import-type query, `typeof` ambient query, DOM/Node
ambient type aliasing, declaration/module augmentation, triple-slash reference,
and symlink escape where supported.

### PF-02: `pure-island-has-no-ambient-authority`

Guarantee: every runtime dependency originates in a value parameter, a local
allocation, or an in-island pure function.

Reject:

- Ambient globals listed in section 6.2.
- `this`, runtime classes, getters/setters, proxy/descriptor indirection.
- Dynamic evaluation/loading.
- Reads or writes of mutable module state.
- Calls whose receiver resolves to module state rather than a parameter/local.
- Awaited values not rooted in an explicit port/local pure call.
- Floating or `void`-discarded promises, unreturned `.then`/`.catch` chains,
  async callbacks passed onward, and promise-producing work launched from a
  returned closure.
- Broad/generic helper parameters that can accept a port and return or invoke
  undeclared authority; allowed generics are constrained to local data-only
  contracts.
- Enumeration/introspection of a port or property access on a port function
  beyond direct invocation of its declared member path.

The implementation is scope-aware. A parameter named `window` is an explicit
value; a global `window` is authority. Shadowing in another function or later
scope does not suppress a finding.

Mutation proofs include shadowing, nested closures, aliased globals, computed
global access, module caches, mutated const collections, helper laundering, and
detached asynchronous work that tries to use a port after return.

### PF-03: `pure-island-exports-are-closed`

Guarantee: a pure island exports only declared functions, immutable plain data,
and types. It does not export a preconstructed mutable object, live port,
singleton, class instance, promise, controller, subscription, or callable facade.

An exported data constant is limited to a deeply immutable literal form. A
mutable array/map/set, stateful regular expression, lazy cache, object with a
custom prototype, or object whose nested member can be mutated is not made safe
by a top-level `const` or TypeScript `as const`. Non-primitive exported constants
are recursively frozen at runtime and verified by descriptor tests; otherwise
the value is allocated within the invocation that uses it.

Mutation proofs cover lazy singleton functions, exported mutable consts,
function-valued object exports, class instances, and hidden symbol properties.

### PF-04: `model-state-is-fields`

Guarantee: every model state and its public state contract contain stored fields
only.

Reject methods, method signatures, call signatures, getters, setters,
function-valued fields, inherited behavior on the state object itself, state
proxies, descriptor-created behavior, callable intersections, and broad nested
fields used as service locators.
Reviewed data containers and exactly declared model-owned resource values remain
legal; shared external infrastructure belongs in explicit binding dependencies.
Stored fields such as `runtime.body` remain legal.

Mutation proofs explicitly contrast a legal `body` field with illegal `get body`
and `body()` members.

### PF-05: `model-operations-are-free`

Guarantee: every production function under `methods/` is free and receives model
state explicitly when it reads or changes that state.

Reject methods attached to an object/class, zero-input state access, importing
the model index/port/adapter, state accessor calls, and a state parameter not in
the required first position for an operation entry.

Nested helpers are governed by PF-01 and PF-02 even when they do not themselves
need state.

### PF-06: `model-port-has-one-lifecycle`

Guarantee: each model has exactly one `port.ts` defining one model adapter and
one binding function.

Verify structurally:

- Outer adapter has `acquire` and `release`; optional `close` is runtime-only.
- Outer adapter has literal `lifetime` and `commitMode` metadata and no other
  undeclared authority.
- Acquired type is exact operations plus `commit`.
- Acquired type has no `acquire`, `release`, `close`, raw state, general service
  bag, index signature, `any`, `unknown`, or unconstrained generic.
- Binding is the only implementation of the lifecycle members.
- `port.ts` imports only same-model state/types/methods; every infrastructure
  implementation is an explicit binding parameter supplied by runtime.
- Port objects use only declared own enumerable data/function properties; their
  prototype is exactly `Object.prototype` or `null`, with no custom inherited
  members, symbols, accessors, or non-enumerable properties. Returned lease
  facades are frozen.
- The declared commit mode is one of staged, immediate, or read-only.
- Every operation's arguments/results are data-only. Port operations accept no
  callback and return no callable/live/lifetime-bearing value other than one
  invocation-owned promise resolving to data.
- A read result cannot be the model's mutable backing object or retain mutable
  aliases into it; it is an immutable snapshot/owned copy or a reviewed
  immutable value.
- Operations are statically named domain members, not reflective dispatch or a
  general service container.
- Every acquisition returns a distinct guarded facade, and extracted members
  fail after their own lease is released without affecting another lease.
- Every ordinary port member and substantive lifecycle action maps to a
  statically named free model method. `port.ts` contains only exact wrappers and
  lifecycle-state dispatch, not domain algorithms.

Mutation proofs cover hidden lifecycle aliases, inherited release, symbol
release, callable state leakage, raw-state getters, missing commit, imported
infrastructure discovery, callback-based transaction escape, general
`execute(name, payload)`, shared-facade invalidation, and extracted use after
release. They also move a valid method body inline into `port.ts` and move a
commit/recovery algorithm into runtime infrastructure; both must fail.

### PF-07: `runtime-alone-builds-models`

Guarantee: model state constructors and `bind<Model>()` have production callers
only in the matching runtime model builder. Each model is constructed and bound
exactly once per declared runtime lifetime.

State constructors are authority-pure initialization functions over explicit
runtime-supplied data. `bind<Model>()` has no ambient/global discovery and imports
only same-model sources; effectful implementations arrive as explicit binding
arguments.

Reject module-load creation, component/capability creation, multiple roots,
unbound state, caller-input-derived acquisition context, duplicate/aliased
acquisition within one capability/procedure execution phase, and a bound adapter
absent from runtime shutdown ownership. A separately released authority-preflight
lease is a distinct governed phase, not an alias exposed to the transformer.

The runtime builder grammar is construction only: create explicit infrastructure,
create state, call `bind<Model>()`, place the returned adapter under its exact
static key, and register close ownership. It cannot invoke domain operations or
host model initialization/mutation algorithms merely because runtime is impure.

### PF-08: `capability-contract-is-local`

Guarantee: every capability entry's context, ports, input, and result are defined
inside the same capability; entries accept no broad authority type.

Every remotely registered entry has exactly `(context, ports, input)` in that
order. A category is an exact local type or literal `undefined`, never omitted or
represented by an open empty object.

Reject missing categories, `ServerModel`, runtime scope types, imported model
types, `any`, post-admission `unknown`, `object`, `Function`, index signatures,
generic service bags, callable context/input/result members, live result handles,
and caller-input authority facts presented as authenticated context.

Validate that raw `unknown` flows only through the operation-local designated
admission subgraph and that the entry receives the admitted type. Admission
helpers cannot accept a port/context or call authority while inspecting raw data.

Domain refusals are admitted data results, never caught exceptions reclassified
by message/shape. The checker rejects a catch that converts an unknown thrown
value into a normal result; it may only perform local cleanup and rethrow.

### PF-09: `capability-adapter-is-exact`

Guarantee: each runtime transformer selects its declared acquisitions and
constructs exactly the capability-local context and port surface.

Reject assertions/casts, spreads/rest, direct port return, computed model keys,
undeclared model reads, closure capture of the complete model collection,
getters/proxies/descriptors, extra own properties, live state returns, and
business decisions in the transformer.

Also reject importing model builders/singleton accessors/adapter instances,
calling anything except a statically selected acquired-port member and approved
data translator, undeclared package/member use, effectful package calls, callback
parameters/results, unfrozen port surfaces, retries, domain conditionals,
catches, and non-translation loops.

The checker compares:

- Registry-declared model names.
- Transformer parameter members.
- Every model member reference in transformer scope and returned closures.
- Capability-local port property names.
- Explicitly constructed returned property names.
- Declarative member-to-model binding records against actual one-call closure
  bodies.

Mutation proofs attempt to smuggle an unrelated logger, generic Store, complete
models object, raw state, release function, callback, async stream, direct model
singleton import, wrong same-shaped model method, and hidden symbol through a
valid surface.

### PF-10: `capability-registry-is-bijective`

Guarantee: externally invoked operation entries, named transformer definitions,
registry entries, declarative binding records, and input-admission functions form
an exact bijection. The remotely callable subset forms an additional exact
bijection with generated remote exports. Private helpers have no production
caller outside their capability and no registration.

Reject missing, duplicate, orphaned, mismatched-name, wrong-owner, wrong-scope,
wrong-transport, and stale entries. Reject module-side-effect registration and
runtime string lookup.

The generator sorts the registry deterministically and generates the remote
export module from it. The checker independently discovers capability entries
and transformer/binding definitions and compares that graph with the canonical
manifest and generated remote output. Manual drift is a failure, not a second
source of truth.

### PF-11: `remote-gateway-is-the-only-crossing`

Guarantee:

- Every production remote export lives in the designated runtime remote module.
- Every exported value is produced by the central gateway with a static registry
  entry.
- Authentication and scope lookup use only the dedicated runtime authority
  boundary; it produces a server-derived scope grant and cannot enter a
  capability port.
- Only that boundary constructs valid scope grants; structural forgeries from
  caller or runtime code fail the owning model's grant validation.
- No capability/component/model imports `$app/server` or defines a remote value.
- Product client code imports no capability runtime value directly; it uses the
  generated central remote module.
- Production server jobs/hooks/runtime modules invoke capability entries only by
  static registry reference through the same governed lifecycle runner and an
  explicit authority policy.
- No alternate gateway bypasses authentication, scope, admission, acquisition,
  commit, or release.

Mutation proofs add a second `.remote.ts`, export a raw capability, alias the
gateway, directly invoke a capability from a scheduled server job, invent an
unscoped system principal, and create a wrapper that omits one lifecycle step.

### PF-12: `gateway-releases-every-acquisition`

The generic runner is small and singular. AST structure plus executable tests
prove partial-acquisition cleanup, reverse release, no commit after entry failure,
auto-commit after success, release after commit fault, primary-fault preservation,
continued reverse cleanup after a release fault, stable cleanup-fault aggregation,
and no use after release.

Rather than attempting whole-program control-flow proof for arbitrary wrappers,
PF-11 prohibits arbitrary wrappers.

The same tests inject cancellation/disconnect and detached-work attempts. A
returned result is checked to be admitted data before transport; an entry cannot
return a lease or a closure that survives `finally`.

Authority tests prove that resolver acquisitions are released on every path,
invalid scope acquires no capability model, caller authority fields cannot alter
the grant, a structural grant forgery fails, and revoking membership between
preflight and read/commit fails the project-bound operation rather than using a
stale grant.

### PF-13: `one-staged-commit-owner`

Guarantee: an automatically committed operation declares no more than one staged
model. Multiple read-only/immediate acquisitions are allowed but do not create a
fictional atomic guarantee.

The checker derives modes from literal outer-adapter metadata rather than a
registry author relabeling a model. It rejects duplicate acquisition names and a
second staged owner reached through a composite alias unless that composite is
itself the sole acquired staged model.

Checkpointed multi-phase entries require an explicit registry marker and focused
durability/compensation tests. Sequential staged commits cannot be labeled
atomic.

Every explicit `commit()` call in an entry's closed static call tree targets the
declared sole staged owner (or a deliberately checkpointed immediate port) and
has a stable checkpoint name in the registry contract. It appears directly in
the entry or in one uniquely owned named capability step. Commit through an
alias, loop, recursion, computed member, shared/generic helper, or callback is
rejected. More than one checkpoint is permitted only when each durable epoch and
recovery path is separately named and tested.

### PF-14: `component-procedures-are-closed`

Guarantee: every component procedure and nested helper is governed by PF-01 and
PF-02, and every invocation receiving model authority goes through the standard
client runner.

Reject a procedure import from adapters/effects/markup, direct remote/model
access, an inline component recreation of acquire/commit/release, and ports held
in module state. Reject raw model state as a procedure authority parameter,
callable/lifetime-bearing procedure data, and detached async work.

Markup event handlers obey the wiring grammar in section 5.4: explicit event-
data extraction plus one named adapter/runner call. The checker rejects inline
domain branching, loops, multi-step mutation, remote/model calls, and copied
procedure bodies outside the governed directory.

Owner adapters receive an exact declared model/remote/browser subset as explicit
parameters and construct frozen procedure ports member by member. Apply PF-09's
no cast/spread/hidden member/direct singleton rules and binding-record/sentinel
routing tests to these adapters. The component or effect may possess framework
authority; the pure procedure receives only the narrow owner-local port surface.

### PF-15: `effects-are-boundaries`

Guarantee: lifecycle APIs and runes occur only in owner `effects/` modules or
markup's minimal wiring; substantive effect decisions call pure procedures.

Enforce the structural effect grammar in section 11.3 rather than a configurable
complexity threshold or ceremonial call count. Verify acquisition identity is
fixed at effect creation, every substantive decision is delegated to a named
pure predicate/procedure, no staged lease survives one procedure invocation, and
every long-lived impure handle remains in the boundary and releases in cleanup.

### PF-16: `pure-generators-produce-the-contract`

Guarantee: capability, model, method, procedure, effect, and adapter generators
produce the target layout, local types, registry entry, transformer, lifecycle
surface, and tests without fresh findings.

Generator tests run each generator in a pristine copy, compare the generated
registry/remote output deterministically, and run every applicable checker.

## 13. Required executable contracts

Static analysis cannot prove concurrency, rollback, durable recovery, or cleanup
behavior. Every model port implementation has executable tests for its declared
mode.

### 13.1 All model adapters

- Acquiring returns the declared operation surface plus commit and no lifecycle
  or hidden properties.
- Two acquisitions return distinct frozen lease facades even if they share an
  underlying concurrency-safe resource.
- Release is called and invalidates the port.
- Double release is harmless.
- Releasing a copied/foreign/different-adapter facade is rejected without
  affecting a real lease.
- Use, an extracted operation, or commit after release fails, while another
  acquisition remains usable.
- Acquire failure leaks no partial resource.
- Operation failure followed by release behaves according to commit mode.
- Concurrent acquisitions exhibit the documented isolation/serialization.
- Mutating a caller argument after a port call resolves cannot alter staged or
  committed model data; the model copied/owned what it retained.
- Optional close refuses new acquisition, settles every active lease according
  to its declared cancellation policy, and is idempotent.

### 13.2 Staged models

- Uncommitted changes are invisible to another acquisition.
- Release without commit discards the open epoch.
- Successful commit publishes one coherent epoch.
- A second epoch begins after commit.
- Conflicting acquisitions refuse or serialize according to the documented
  policy; they never silently overwrite.
- Pre-decision faults leave old durable state.
- Post-decision faults recover the committed state.
- Commit failure prevents further use until release.

### 13.3 Immediate models

- The exact irreversible operation and idempotency behavior are documented.
- Commit's no-op/checkpoint behavior is tested.
- Release does not claim to undo a completed external effect.
- Ambiguous acknowledgements are not blindly retried.

### 13.4 Gateway and transformers

- Invalid/unauthorized scope acquires no capability model; any authority-resolver
  lease used to determine that result is released.
- Invalid input after valid scope releases nothing because nothing is acquired.
- Partial acquisition failure releases earlier ports in reverse.
- Entry failure causes no automatic commit and releases all ports.
- Typed domain-refusal results from failure-atomic operations leave no unwanted
  stage and encode normally; every thrown operational/storage/provider/
  cancellation fault aborts and is not reclassified or exposed.
- Invalid result encoding causes no automatic commit and releases all ports.
- Success auto-commits the staged owner before release.
- Explicit checkpoint persists before subsequent external work.
- A later failure does not erase a prior checkpoint.
- Another project's resource remains inaccessible through every transformer.
- Revoking membership after preflight but before a project-bound read/commit
  invalidates the stale scope grant at the owning atomic boundary.
- Every capability-port member routes sentinel arguments/results through its
  declared model-port member; substituting another same-shaped method fails.
- A port cannot accept a callback or return a callable/iterator/stream/live
  handle, and a capability result cannot retain a port.
- Detached asynchronous work is rejected statically and a forced use after
  release is rejected dynamically.
- The actual remote export traverses the gateway; a direct unit call is not the
  only evidence.

### 13.5 Component invocation

- Procedure failure does not auto-commit staged client state.
- Success commits and releases.
- Component unmount releases long-lived acquisitions.
- Switching tab/resource cannot redirect an earlier acquisition's work.
- Concurrent component instances do not share procedure-local/module state.

## 14. Adversarial review

The following attacks were considered part of the contract design. Each must be
represented by a mutation test, executable contract, or both before enforcement
is considered complete.

| Attack | Why a shallow checker misses it | Required defense |
| --- | --- | --- |
| Re-export a forbidden module through an allowed local file | Direct-import blacklist sees only the local path | PF-01 resolves the complete transitive graph and reports the escape chain |
| Use a type-only import to couple islands | Runtime graph is clean but contracts share authority vocabulary | PF-01 governs type edges exactly like value edges |
| Hide loading behind `import()`, `require`, or a computed module name | Static import visitor misses it | PF-01/PF-02 reject all dynamic loading in pure islands |
| Import an external package that later performs I/O | Package name is not on a forbidden list | Pure islands permit no package imports |
| Rename or shadow `window`, `Date`, or another global | Name-only scan confuses bindings | PF-02 resolves lexical scope and symbols |
| Reach a global through `globalThis[key]` | Property name is computed | `globalThis`, computed authority access, eval, and Function are forbidden |
| Keep state in a mutated module-level `const Map` | `const` appears immutable | PF-02 tracks mutation and PF-03 rejects exported/live module objects |
| Put methods on state through a prototype, descriptor, proxy, or symbol | Surface AST sees no ordinary method | PF-04 bans inheritance/proxy/descriptors/symbol members and runtime tests inspect descriptors |
| Move a model operation or commit algorithm inline into `port.ts`/runtime construction | The governed `methods/` tree remains clean | PF-06/PF-07 restrict boundaries to lifecycle/construction grammars and require static delegation to named free methods |
| Give an acquired port a hidden `release` alias | Declared TypeScript shape omits it | PF-06 requires explicit ordinary-object construction and inspects all own/prototype/symbol descriptors |
| Return the same acquired facade to concurrent callers | Each type is correct, but one release can invalidate another caller | PF-06 and lifecycle tests require a distinct guarded lease facade for every acquire |
| Extract a port method before release and call it later | Guarding only property access misses the retained closure | Every operation closure checks its lease state at invocation time |
| Return raw state typed as a local DTO | Structural typing accepts matching fields | PF-09 forbids casts/direct returns; transformer must construct owned data; tests mutate source after read |
| Cast the full model port to a narrow capability port | Type checker trusts assertions | PF-09 bans assertions and requires explicit member construction with `satisfies` |
| Spread a full model/port then rely on excess-property typing | Extra runtime authority survives | PF-09 bans spread/rest and compares exact own properties |
| Capture the complete model collection in an apparently narrow closure | Returned object shape looks exact | Transformer receives only declared acquired subset; PF-09 resolves closure references |
| Import a singleton/model builder directly inside the transformer | The declared transformer parameter still looks narrow | PF-09 restricts model access to explicit acquired parameters and rejects runtime/model accessors |
| Declare one model but access another with a computed key | Property scan misses the name | Computed service keys are forbidden; registry dependencies and symbol references must match |
| Bind a correctly typed capability member to the wrong same-shaped model method | Type and surface checks both pass | Declarative binding record is compared to the closure AST; sentinel adapter tests prove routing |
| Expose `execute(name, payload)` or a generic Store bag | The port is explicit but carries unbounded authority | PF-06/PF-08 require named domain operations and closed data contracts; reflective dispatch is forbidden |
| Pass a capability callback into `transaction(work)` | The model port is explicit, but the closure carries every captured capability port across the boundary | Port operation arguments/results are data-only; atomic work is a named model operation over a closed command |
| Call `release` from a capability under a different local name | Lifecycle leaks through adapter | Acquired-port exactness and transformer member comparison reject lifecycle members and aliases |
| Forget release on an exception | Happy-path tests pass | One central gateway/runner with `finally`; PF-11 bans alternatives; PF-12 injects every failure boundary |
| Start an unawaited port call and return before it finishes | `finally` releases while captured authority is still executing | PF-02 rejects floating/detached promises and lease guards make late use fail deterministically |
| Return a closure, stream, iterator, or subscription that retains a port | The entry itself has returned successfully | Context/input/result data-only rules and PF-03/PF-08 reject lifetime-bearing results |
| Let release commit partial work | Cleanup looks successful | Normative release-never-commits rule plus staged failure tests |
| Auto-commit after a capability fault | Generic finally accidentally commits | Gateway ordering test requires commit only on normal return |
| Commit before discovering that the result contains a live/invalid value | Entry returned normally, so a shallow runner treats it as success | Gateway fully validates/encodes result while the staged epoch is still abortable |
| Return a refusal-looking storage/provider fault to the caller | Error classification by message or loose `kind` leaks/mislabels faults | Gateway never classifies thrown values; domain refusals are typed results from failure-atomic operations |
| Commit two independent staged models and call it atomic | Both commits pass individually | PF-13 permits only one staged commit owner absent an explicit coordinator |
| Clone mutable state but overwrite a concurrent commit | Isolation without conflict detection loses data | Staged-model concurrency tests require serialization or revision conflict |
| Hold a lock across external I/O accidentally | Correctness survives but throughput/deadlock fails | Port concurrency contract identifies checkpoint/release boundaries; focused contention tests |
| Acquire models in different orders | Separate capabilities deadlock | Registry defines one canonical acquisition order and reverse release |
| Acquire the same model twice under aliases | Canonical order alone does not prevent two conflicting stages | Registry dependencies are duplicate-free and the runner produces one lease per named model |
| Retry after a durable commit whose response was lost | Caller sees failure and duplicates work | Request-key/idempotency contracts; gateway never retries ambiguous commands blindly |
| Trust `projectId` or `userId` in input | Types look valid | Gateway constructs identity/scope; capability inputs cannot establish authority |
| Revoke membership after gateway preflight but before a read/commit | Initial authorization passed, producing a time-of-check/time-of-use gap | Versioned scope grant is revalidated by the project-bound model operation at its read/atomic commit boundary |
| Return another project's live row through a general Store port | Scope gate alone is too coarse | Capability-specific project-bound ports plus ownership tests |
| Put business branching in the transformer | Capability appears pure but is ceremonial | PF-09 enforces a narrow construction/one-call translation grammar plus binding tests |
| Put business branching in an effect | Procedure remains pure but behavior moves to lifecycle code | PF-15 enforces the structural effect grammar and delegates every decision |
| Move a procedure body into a Svelte event handler | The procedure directory remains perfectly clean | PF-14 restricts markup handlers to event-data capture plus one named governed invocation |
| Import a component-local adapter from a component-local procedure | Same owner path appears legitimate | PF-01 uses sub-zone rules, not only owner-root containment |
| Put an impure effect below `procedures/effects` | Folder is beneath a supposedly pure island | Target layout moves effects out; PF-14/PF-15 reject the old nesting |
| Add an unregistered remote file | Central gateway remains correct but bypass exists | PF-10/PF-11 discover every `.remote` file and enforce one location |
| Register a capability through module side effects | Runtime order and hidden mutable registry emerge | Registry must be static; PF-10 rejects registration calls and mutable maps |
| Copy `projectId`, `userId`, role, or scope from caller input into context/acquisition | Names and types resemble valid authority | Gateway origin analysis and authority tests require server-derived facts; input is supplied only to admission |
| Hide a database/provider/service locator inside a broad state field | The state has no direct model-method declaration | PF-04 permits exact model-owned resource values but requires shared external infrastructure as explicit binding inputs and rejects broad nested services |
| Leave generated registry output stale | Source and exposure disagree | PF-16 regenerates and byte-compares deterministic output |
| Silence a finding with a comment or broad baseline | Architecture appears green without compliance | No suppressions/exemptions for these checks; mutation suite rejects suppression syntax |

### 14.1 Residual limits

No TypeScript checker can prove termination, business correctness, or the
honesty of an arbitrary runtime implementation. This contract therefore removes
outside code from pure islands, narrows the permitted source grammar, makes
runtime authority construction explicit, and pairs static checks with behavioral
contracts at every impure boundary.

A developer deliberately modifying the checker and product together can always
weaken a local rule. Catalog mapping, mutation tests, generated-output tests,
reviewable checker size, and architecture review are the defense against that
class of change. The target is no accidental escape and no plausible one-file
bypass—not a claim that source code can defend itself from an authorized rewrite
of its enforcement system.

### 14.2 Known implementation risks in the current tree

These are design constraints, not exceptions to the contract:

- **Store cannot be mechanically wrapped.** Its current public transaction is a
  synchronous, non-nestable callback that opens and commits within one call. A
  capability lease can span `await`, and callable arguments are forbidden across
  the acquired-port boundary. The Store exemplar therefore needs a new
  acquisition-local command/snapshot stage and a short synchronous durable
  commit implementation. It MUST NOT retain today's Store unit across `await` or
  expose `transaction(work)` through the capability adapter.
- **Process-local serialization is not distributed concurrency.** The current
  Store instance, OperationFlights ownership, and native-file mutation queue have
  process-local lifetimes. A port may declare that fact, but it cannot claim
  cross-process exclusion. A multi-process deployment needs a single-writer
  topology, database transaction/lock, compare-and-swap revision, durable lease,
  or another explicit coordination mechanism before its adapter can promise that
  concurrency mode.
- **A long acquisition must not imply a long infrastructure transaction.** A
  runtime lease is a logical use lifetime. A database-backed model may acquire a
  lightweight staged command buffer/revision token and open a database
  transaction only during `commit()`. Holding a database transaction or mutex
  across provider/network/UI awaits requires an exceptional, measured model
  contract and cannot be the default binder behavior.
- **Structural typing is not a runtime membrane.** Local duplicate types prevent
  import coupling but do not clone values. Exact construction, frozen lease/port
  facades, owned-data translation, descriptor tests, and use-after-release guards
  are all required; `satisfies` alone proves none of them.
- **A transformer can be type-correct and semantically wrong.** The narrow AST
  grammar and declarative binding record constrain it, while per-member sentinel
  tests prove the selected method and translation. Human review remains required
  for whether that named mapping represents the intended business meaning.
- **Centralization enlarges the gateway's security importance.** The registry,
  server models, scope resolver, and infrastructure must remain server-only and
  absent from client output. Bundle inspection and an end-to-end unauthorized
  remote call are completion evidence, not merely unit tests of a helper.
- **Explicit checkpoints create durable partial progress by design.** They need
  idempotency keys, resumable durable state, or compensation. A checkpoint flag
  is not permission to sequentially commit unrelated models or retry an
  ambiguously acknowledged command.
- **Local contract duplication can drift.** The duplication is intentional
  independence, but generators, registry bijection, adapter binding records, and
  sentinel translation tests must expose drift immediately.
- **Release faults need aggregation.** Reverse cleanup continues after one
  release fails. The first operation/commit fault stays primary; all cleanup
  faults are attached in stable order and reach observability without leaking
  sensitive request or model data.
- **Strict migration will be noisy.** Existing method imports from representation
  modules, callback transactions, class wrappers, capability-local remote files,
  and `procedures/effects/` are expected failures. Broad baselines would erase
  the roadmap. The full checker therefore continues reporting the entire red
  inventory while focused developer commands verify a current slice; no scope
  manifest removes unmigrated production from the governed set, and integration
  waits for the full set to pass.

## 15. Generator contract

### New capability

The generator creates:

- Capability-local context, port, input, and result types.
- Local admission and entry functions.
- Unit and authority test skeletons.
- One runtime transformer file.
- One sorted registry entry.
- One static remote export when declared remote.
- No external imports in capability production code.

Removing a capability removes the same graph; stale registry/remote entries fail.

### New model

The generator creates:

- Field-only state and explicit state constructor.
- Free operation directory.
- `port.ts` with operation, acquired-port, adapter, acquire, commit, release, and
  optional close surfaces.
- A binding implementation with explicit lifetime and commit mode literals.
- Runtime model construction/binding entry.
- Lifecycle, descriptor-exactness, and concurrency test skeletons.

### New operation/procedure

The generator creates a free function in the correct pure island, local types,
and no outside imports. A component effect is generated outside procedures and
must name the procedure it binds when it contains substantive behavior.

## 16. Migration sequence

1. Approve this contract before changing the prototype checker further.
2. Replace `CapabilityContext.model` with server facts only; do not preserve an
   alias for the old shape.
3. Establish the model `state.ts`/`port.ts` lifecycle using one read-only model
   and the Store staged model as contrasting executable examples.
4. Establish the runtime model collection, central gateway, static registry, and
   one read capability.
5. Migrate one revisioned transactional capability and one external-I/O durable
   workflow to prove commit/checkpoint/compensation semantics.
6. Replace blacklist-first prototype checks with PF-01 through PF-13 and their
   adversarial mutations. Let unmigrated production fail in the worktree rather
   than creating broad new exceptions.
7. Update generators only after the exemplar shapes are executable.
8. Migrate remaining server capabilities and remove capability-local remote
   files as their central registrations land.
9. Migrate model families to field-only state, free methods, and acquired ports.
10. Add client model acquisition and component adapters; move effects out of
    procedures; migrate component procedure islands.
11. Remove the prototype baseline records as each exact finding is resolved.
12. Run typecheck, the full checker mutation suite, model lifecycle/concurrency
    contracts, Store durability and ownership contracts, unit suites, build, and
    relevant Chromium workflows before integration.

No legacy API aliases, compatibility re-exports, old remote modules, or silent
fallbacks survive a migrated slice.

## 17. Completion criteria

The architecture is complete only when:

- Every production capability, model method, and component procedure belongs to
  a discovered pure island.
- Every pure island has a closed direct and transitive import graph.
- Every pure-island function passes the authority/source checks.
- Every model state is fields-only and runtime-created exactly once per lifetime.
- Every model has a tested acquire/commit/release adapter and declared concurrency
  mode.
- Every acquisition is a distinct guarded lease, and no callback/live handle can
  carry its authority across a port boundary or past release.
- Every capability receives only local context/input/result types and exact
  capability-local ports.
- Every runtime transformer is exact, cast-free, and unable to leak undeclared
  models or live state; its binding record and sentinel tests prove each named
  member route.
- Externally invoked capability entries, transformers, binding records, and
  registry records are an exact bijection; the remotely callable subset is an
  exact bijection with generated remote exports.
- Authentication/runtime-principal resolution, scope resolution, input
  admission, acquisition, successful commit, and unconditional release occur
  through the governed gateway/internal boundary and one shared invocation
  runner.
- Every automatically committed operation has at most one staged commit owner,
  and any explicitly checkpointed partial progress has recovery/idempotency or
  compensation evidence.
- Component effects/adapters are outside pure procedures and use the governed
  client invocation lifecycle.
- Every adversarial case in section 14 has executable mutation or behavioral
  evidence.
- The architecture checker reports no fresh, suppressed, exempted, or baselined
  violation anywhere in governed production scope.
- The branch passes proportionate Store durability, ownership, concurrency,
  unit, build, and Chromium verification for the migrated behavior.

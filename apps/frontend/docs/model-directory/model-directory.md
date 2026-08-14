# The Model Directory

**Status:** Translation and implementation specification. This replaces
`src/lib/runtime/` with `src/lib/model/` while preserving the current client and
server lifetimes.

## Contract

- A model object owns state or a resource that survives a procedure call.
- Every production model object is a singleton in its environment process.
- `model/client/` owns one graph for one browser JavaScript process.
- `model/server/` owns one graph for one server process.
- The environment root constructs, caches, and releases the graph. Leaf object
  modules never create independent singleton caches.
- Public methods expose an object's surface; their directories expose the
  procedural flow behind that surface.

“Singleton” describes production lifetime. Constructors still return fresh
objects so the roots can assemble the graph and tests can prove isolation.

Capabilities remain the procedural half of the application model: they own
database-backed data and hold nothing between calls. Model objects are the
stateful half.

## Target layout

```text
src/lib/model/
├── model.md
├── client/
│   ├── client.md                    browser lifetime and isolation contract
│   ├── index.ts                     public door and guarded singleton accessor
│   ├── types.ts                     aggregate ClientModel type
│   ├── constructor.ts               constructs the complete client graph
│   ├── test/                         graph, lifetime, and isolation tests
│   └── <object>/
└── server/
    ├── server.md                    process lifetime and shutdown contract
    ├── index.server.ts              public door and lazy singleton accessor
    ├── types.ts                     aggregate ServerModel type
    ├── constructor.server.ts        constructs the complete server graph
    ├── scope.server.ts              per-request identity and authority
    ├── test/                         graph, concurrency, and shutdown tests
    └── <object>/
```

The client and server directories are environment composition roots. Their
object directories all use the same leaf shape:

```text
model/{client|server}/<object>/
├── <object>.md                      ownership, surface, dependencies, invariants
├── index.ts | index.server.ts       composition door
├── types.ts                         interface and public value types
├── definition.svelte.ts | definition.ts
│                                      state/resource holder; delegates methods
├── constructor.ts                   always returns a fresh object
├── methods/
│   ├── methods.md                   public method inventory and shared laws
│   ├── <simple-method>.ts
│   ├── <complex-method>/
│   │   ├── <complex-method>.md
│   │   ├── <complex-method>.ts
│   │   ├── <supporting-method>.ts
│   │   └── <supporting-method>/
│   │       ├── <supporting-method>.ts
│   │       └── <leaf-method>.ts
│   └── shared/
│       ├── shared.md
│       └── <shared-method>.ts
├── docs/                            optional material with no narrower owner
└── test/
    ├── unit/
    ├── regression/
    └── non-functional/
```

Optional directories are absent when unused. A client definition uses
`.svelte.ts` only when it owns Svelte runes. Stateless client projections and
server definitions use `.ts`.

## Lifetime and construction

Both environments follow the same ownership pattern:

```text
environment accessor
└── one cached aggregate
    ├── one instance of object A
    ├── one instance of object B
    └── one instance of object C
```

An object does not obtain singleton lifetime by caching itself. Its constructor
returns a fresh instance; the environment constructor calls it once, and the
environment accessor caches the completed graph once.

This gives one place to enforce construction order, browser/server admission,
failure cleanup, and shutdown. It also prevents independently cached objects
from accidentally belonging to different graphs.

### Client process

A client process is one browser page's JavaScript realm. Navigation beneath the
application layout retains the same graph. Reloading the page or opening another
tab creates another graph. Persistent storage may be shared by the browser
origin; live objects and reactive state are not.

The production path is:

```text
clientModel()
├── reject when browser === false
└── create once
    └── createClientModel(createBrowserStorage())
        ├── createPreferences(storage)
        ├── createWorkbench(storage)
        ├── createActivities(workbench)
        └── createInspector(workbench)
```

`model/client/index.ts` owns the only client cache and the only import of
`browser` from `$app/environment`:

```ts
let instance: ClientModel | undefined;

export const clientModel = (): ClientModel => {
  if (!browser) throw new Error("The client model is browser-only");
  return (instance ??= createClientModel(createBrowserStorage()));
};
```

`model/client/constructor.ts` is pure composition over injected storage. It is
not browser-guarded and is not an application-facing alternative to
`clientModel()`. The root and tests use it; routes, views, capabilities, and
server code do not.

Client isolation has two required parts:

1. `src/routes/app/+layout.ts` exports `ssr = false`, so the application shell
   and its descendants are not rendered on the server.
2. `clientModel()` checks `browser` before storage access or construction.

SSR disabling alone is insufficient because SvelteKit may load component
modules on the server while assembling the route and its CSS. The guard ensures
the client graph is never constructed in a shared server module process.

Leaf modules contain no module-scope mutable identity, constructed object, or
second browser guard. `$state`, counters, subscriptions, and other live state
belong to their object instance.

### Server process

A server process owns one server graph. A multi-process deployment has one graph
per worker. The graph contains process infrastructure only; user and project
identity arrive per request through `Scope`.

`model/server/index.server.ts` owns the in-flight construction promise and
terminal shutdown state:

```text
serverModel()
├── reject after shutdown begins
├── return existing construction promise
└── otherwise build once
    └── createServerModel()
        ├── configuration
        ├── observability
        └── persistence
```

Caching the promise makes concurrent first requests share initialization. A
failed construction is evicted so a later request may retry. Shutdown is
idempotent and one-way: it closes owned resources in dependency order and never
permits a replacement graph to start while the first is closing.

`hooks.server.ts` obtains this same singleton graph and places its reference on
each request's locals. It does not construct a graph per request.

## File responsibilities

### Environment root

| File | Responsibility |
| --- | --- |
| `index.ts` | Client public exports, browser admission, and cached aggregate |
| `index.server.ts` | Server public exports, lazy process promise, and shutdown |
| `types.ts` | Names every object present in the aggregate model |
| `constructor*` | Calls every leaf constructor once in dependency order |
| `client.md` / `server.md` | Defines lifetime, construction, failure, and release behavior |

Production consumers enter through the environment door and select an object
from the aggregate:

```ts
const { workbench } = clientModel();
const { persistence } = event.locals.model;
```

### Object directory

| Part | Responsibility |
| --- | --- |
| `<object>.md` | Explains ownership, public surface, dependencies, invariants, and lifetime behavior |
| `index*` | Exports the fresh constructor and types to the environment root and permitted dependent objects |
| `types.ts` | Defines the object interface and public values; no implementation state escapes |
| `definition*` | Holds instance state/resources and delegates public calls to `methods/` |
| `constructor.ts` | Validates dependencies, acquires resources, and returns a fresh definition |
| `methods/` | Shows the execution flow behind the public surface |
| `test/` | Proves behavior owned by this object |

The object door is a composition door, not a second production access path.
Application consumers receive its singleton instance from the aggregate; they
do not call `create<Object>()` themselves.

## Method execution trees

The definition is the readable object surface. It delegates rather than
accumulating implementation:

```ts
export class Workbench implements WorkbenchModel {
  open(resource: ResourceRef): Tab {
    return open(this.#state, resource);
  }
}
```

A complete method is one file:

```text
methods/activate.ts
```

A method becomes a directory when it owns supporting flow:

```text
methods/open/
├── open.md
├── open.ts
├── canonical-resource.ts
└── restore/
    ├── restore.ts
    └── validate-stored-kind.ts
```

The directory and entry file always share a name. Nesting repeats recursively.
The complex method document contains the method tree and names the real paths.

A supporting method used by one public method stays below that method. A method
used by a second public method moves to `methods/shared/` only when it preserves
an object-wide invariant. Sibling public-method directories never import one
another.

This is the same execution-tree rule capabilities already use for
`api/<function>/`. Capability functions always get directories because each is
an independently documented server API. Model methods stay as files until they
have a supporting tree.

## Exposure rules

- `$model/client` and `$model/server/index.server` are the production doors.
- Application code never imports `constructor.ts` or calls leaf constructors.
- The environment constructor imports each leaf through its object door.
- An object imports another object through that object's door, never its
  definition, methods, or state types.
- Client code never imports the server tree.
- Server code, capabilities, hooks, loads, and actions never import the client
  tree.
- Only server-marked code imports the server tree.
- Models do not import routes or capability implementations.
- Model objects expose stable view keys, never Svelte components or component
  registries. Those mappings belong to views.

## Tests

Environment tests prove singleton lifetime and graph behavior:

- repeated access returns the same aggregate and the same leaf references;
- every aggregate field is constructed exactly once;
- two explicit test graphs over separate dependencies share nothing;
- client server-side access fails before storage or leaf construction;
- concurrent server access shares one construction promise;
- failed server construction cleans up and permits retry;
- shutdown is idempotent, closes all owned resources, and prevents rebuild.

Object tests use fresh constructors. `unit/` mirrors methods and construction,
`regression/` holds one fixed defect per file, and `non-functional/` covers
reactivity, concurrency, persistence, and cleanup.

## Enforcement

```text
scripts/lint/model/
├── lint.mjs
├── rules.mjs
└── test/
    ├── build-fixtures.mjs
    └── lint.test.mjs
```

`rules.mjs` uses the installed TypeScript compiler API for TypeScript modules
and `svelte/compiler` for Svelte script blocks. Rules return structured failures;
`lint.mjs` only resolves package paths, formats all failures, and sets the exit
code. Every rule has a valid fixture and an isolated failing mutation.

| Rule | What it enforces |
| --- | --- |
| `MOD001 layout` | Only the documented environment-root and object shapes exist; names are kebab-case and required documents are present. |
| `MOD002 aggregate` | `ClientModel` and `ServerModel` fields match the objects returned by their constructors; every field is assigned exactly once. |
| `MOD003 singleton-owner` | Only environment roots cache constructed graphs. Leaf modules have no module-scope `let`, `var`, `new`, or `create<Object>()` result. |
| `MOD004 client-gate` | Only `client/index.ts` imports `$app/environment`; its accessor checks `browser` before browser storage and construction. |
| `MOD005 client-ssr` | Every route import graph reaching `$model/client` is beneath a layout exporting `ssr = false`; server modules never reach the client tree. |
| `MOD006 server-boundary` | Browser modules cannot reach `model/server`; production server imports enter through server-marked doors. |
| `MOD007 construction` | Application consumers cannot import environment or leaf constructors; roots call leaf constructors in dependency order without cycles. |
| `MOD008 method-tree` | Complex method directories contain same-name entries and documents recursively; every documented tree path exists. |
| `MOD009 method-ownership` | Sibling method directories do not import one another; shared methods have at least two public-method callers. |
| `MOD010 doors` | Imports across object and environment boundaries use doors; definitions, methods, and private types are not deep-imported. |
| `MOD011 tests` | Tests live under environment or object `test/` directories and use the correct environment-specific extensions. |

`MOD003` and `MOD004` absorb the current client-construction checks that are
temporarily housed in capability lint. Capability lint then returns to governing
capabilities only.

The package exposes `lint:model`; aggregate `lint` runs capability, model, view,
and style structural checks.

## Generation

```text
scripts/generation/model/
├── new-model-object.mjs
├── shared.mjs
└── test/
    └── generation.test.mjs
```

Usage:

```text
pnpm new-model-object -- client <name> \
  --definition <reactive|plain> \
  [--depends <object,object>]

pnpm new-model-object -- server <name> \
  --construction <sync|async> \
  [--depends <object,object>]
```

The generator:

1. validates the environment, kebab-case name, dependencies, and absence of a
   dependency cycle;
2. creates the object document, types, definition, constructor, door, and
   `methods/methods.md`;
3. uses `.svelte.ts` only for an explicitly reactive client definition;
4. adds the object interface to the environment aggregate type;
5. adds one constructor call and one returned aggregate field in topological
   dependency order;
6. adds the object to the environment document's generated inventory;
7. runs model lint against the planned result;
8. writes the plan without overwriting existing files and restores original
   bytes if a write fails.

The generator creates no empty `docs/` or `test/` directories and does not
invent public methods. Methods are designed from their signatures and behavior;
the simple-file or complex-directory choice is made when each method is added.

Generator tests cover both environments, reactive and plain client definitions,
sync and async server construction, dependency ordering, cycle rejection,
collision refusal, rollback, and a clean model-lint result.

## Translation

1. Add `$model` and the model linter against fixtures.
2. Move the client root to `model/client/`; split aggregate types and pure
   construction from the guarded accessor. Preserve `ssr = false`, the single
   browser guard, browser storage behavior, and one instance of every object.
3. Move each client object. Extract public implementation into method trees.
   Move activity and inspector component registries into the view layer without
   changing their stable keys or selection behavior.
4. Move the server root; split construction from its lazy accessor. Preserve
   promise caching, failure eviction, per-request `Scope`, shutdown order, and
   one instance of every process object.
5. Move each server object and expose its method flow.
6. Rename `ClientRuntime` and `ServerRuntime` to `ClientModel` and `ServerModel`;
   rename `clientRuntime()` and `serverRuntime()` to `clientModel()` and
   `serverModel()`; rename `App.Locals.runtime` to `model`.
7. Update capability and route imports from `$runtime` to `$model`, enable model
   lint, then remove the old alias and `runtime/` tree.

The translation is complete when production behavior is unchanged, repeated
access returns the same per-process objects, client construction is impossible
on the server path, all method trees and doors pass lint, and the old runtime
vocabulary no longer exists.

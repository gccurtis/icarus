# The Model Directory

**Status:** The standard for model objects in this application. Read it before
adding a model object, a public method, or an environment root. It governs
`src/lib/model/`, and model lint (`pnpm lint:model`) enforces its structure.

**This document describes structure, not design.** What shape a directory takes,
which file may import which, and what a reviewer can check are here. *Why this
application's model is built the way it is* — what a client instance is, why the
server graph is built in a hook, what the workbench owns — belongs beside the
code that decides it:

| Question | Answered in |
| --- | --- |
| What is here, and why the two halves differ | [`model/model.md`](../../src/lib/model/model.md) |
| How a client instance is built, held, and released | [`model/client/client.md`](../../src/lib/model/client/client.md) |
| How the process graph is built and shut down | [`model/server/server.md`](../../src/lib/model/server/server.md) |
| What one object owns, and what it promises | that object's `<object>.md` |

**Document templates:** [`templates/`](templates/templates.md).
[`reviewing-a-model-object.md`](reviewing-a-model-object.md) is the review
checklist, and its "Structure" items are what the linter checks for you.

## Contract

- A model object owns state or a resource that survives a procedure call.
- **No object builds itself at module load.** One environment root holds one
  instance, and one place initializes it.
- `model/client/` owns one graph per client instance — one browser tab now, one
  desktop window later — for that instance's whole life.
- `model/server/` owns one graph for one server process.
- The environment root constructs, holds, and releases the graph. Leaf object
  modules never hold instances of their own.
- Public methods expose an object's surface; their directories expose the
  procedural flow behind that surface.

"One instance" describes production lifetime. Constructors still return fresh
objects so the roots can assemble the graph and tests can prove isolation.

Capabilities remain the procedural half of the application model: they own stored
data and hold nothing between calls. Model objects are the stateful half.

## Target layout

```text
src/lib/model/
├── model.md
├── client/
│   ├── client.md                    client-instance lifetime and initialization
│   ├── index.ts                     public door, initializer, and accessor
│   ├── types.ts                     aggregate ClientModel and ClientModelInput
│   ├── constructor.ts               buildClientModel: composes the client graph
│   ├── test/                         graph, lifetime, and isolation tests
│   └── <object>/
└── server/
    ├── server.md                    process lifetime and shutdown contract
    ├── index.server.ts              public door, initializer, accessor, shutdown
    ├── types.ts                     aggregate ServerModel type
    ├── constructor.server.ts        buildServerModel: composes the server graph
    ├── scope.server.ts              per-request identity and authority
    ├── test/                         graph, lifetime, and shutdown tests
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
│   ├── methods.md                   method inventory and shared laws
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
`.svelte.ts` only when it owns Svelte runes. Server definitions use `.ts`.

**The object root holds what an object *is*** — its document, its door, its
types, its state, and its constructor, and nothing else. Everything an object
*does* lives in `methods/`, including a module that is not a public method at
all: a codec, a wire format, a parser is still the execution behind the surface,
and `methods.md` is where it names the caller it serves. A file at the root with
no decided home is one nobody decided the home of, and `layout` refuses it.

### Three construction verbs

| Function | Called by | Returns |
| --- | --- | --- |
| `init<Environment>Model(…)` | the one place that owns the lifetime | the graph, and holds it |
| `build<Environment>Model(input)` | that initializer, and tests | a complete graph; pure composition |
| `create<Object>(dependencies)` | the builder, once each | one fresh object |

The three are named separately because their callers differ, and because
collapsing any two removes a seam something depends on.

`init` is the only thing that assigns the instance, and exactly one place calls
it. `build` is pure composition and holds nothing, which is what lets a test
stand up two whole graphs and prove they share nothing. `create` returns one
fresh object and never caches.

**A door does not re-export its builder.** The initializer and tests are the
whole set allowed to hold a graph, so publishing the builder beside the accessor
would offer a second way to build one — and a second graph is what this shape
exists to prevent. A test reaches a builder at its constructor module, which the
door rules exempt test code from.

### `definition.ts` and `constructor.ts` are model filenames

[The Capability Directory](../capability-directory/capability-directory.md)
lists both among names that appear nowhere under `capabilities/`. This standard
mandates both. The rules agree rather than collide: a capability is procedural
and has no object to define or construct, so either filename appearing beneath
`capabilities/` means someone imported this model into a place with no lifetime
to hold. Read the pair as one rule about where objects live.

## File responsibilities

### Environment root

| File | Responsibility |
| --- | --- |
| `index.ts` | Client public exports, the one instance, its initializer, and its accessor |
| `index.server.ts` | Server public exports, the one instance, its initializer, accessor, and shutdown |
| `types.ts` | Names every object present in the aggregate model, and the root's input |
| `constructor*` | `build<Environment>Model`: calls every leaf constructor once in dependency order |
| `client.md` / `server.md` | Defines lifetime, construction, failure, and release behavior |

**The aggregate `types.ts` is required at each root**, not written only when
something needs it. Both the builder and the accessor return a named
`ClientModel` or `ServerModel`, and a contract inferred from a constructor cannot
be referenced by the consumers that have to name it: the file declaring what it
initialized, the test substituting one object, the helper taking the graph as a
parameter.

Production consumers enter through the environment door and select an object
from the aggregate:

```ts
const { workbench } = clientModel();
const { observability } = event.locals.model;
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
Application consumers receive the one instance from the aggregate; they do not
call `create<Object>()` themselves.

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

**`methods/shared/` is created by hand, when its second caller arrives.** There
is no promotion command, matching the capability generator, which has none
either. Promotion is a judgment about which invariant the method preserves, and a
command would turn it into a mechanical move of any code that appeared twice.

This is the same execution-tree rule capabilities already use for
`api/<function>/`. Capability functions always get directories because each is
an independently documented server API. Model methods stay as files until they
have a supporting tree.

## Exposure rules

- `$model/client` and `$model/server/index.server` are the production doors,
  plus `$model/server/scope.server` for request identity.
- **`scope.server.ts` is a door rather than an internal file**, and it has to be
  one. It resolves who is asking and about which project, so a remote wrapper and
  `hooks.server.ts` both reach it directly. Folding it behind `index.server.ts`
  would mean the root re-exporting values from a module that imports
  `serverModel` back out of the root — a real import cycle, and one `graph` would
  then have to be taught to ignore. The root already re-exports `Scope` and
  `Session` as types, which is erased and therefore safe; the functions cannot
  follow them. It stays a narrow door: identity in, `Scope` out, and no process
  object reachable through it.
- Only the one place that owns a lifetime calls `init<Environment>Model`.
  Everything else calls the accessor.
- Application code never imports `constructor.ts` or calls leaf constructors, and
  no door re-exports a builder.
- The environment constructor imports each leaf through its object door.
- An object imports another object through that object's door, never its
  definition, methods, or state types.
- **Only an environment door reaches `$app/*`.** A leaf taking `browser`, `page`,
  or `navigating` is taking its identity from ambient routing rather than from
  the argument its constructor was handed.
- Client code never imports the server tree.
- Server code, capabilities, hooks, loads, and actions never import the client
  tree.
- Only server-marked code imports the server tree.
- Models do not import routes or capability implementations.
- Model objects expose stable view keys, never Svelte components or component
  registries. Those mappings belong to views.

## Tests

Environment tests prove lifetime and graph behavior:

- the accessor throws before the graph is built, and returns it afterwards;
- repeated access returns the same aggregate and the same leaf references;
- every aggregate field is constructed exactly once;
- two graphs built over separate dependencies share nothing;
- a failed build leaves nothing reachable;
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

**Rules are named, not numbered.** A finding leads with its rule name, so the
message says what was violated without a table to look it up in. Capability and
view lint carry no codes either.

| Rule | What it enforces |
| --- | --- |
| `layout` | Only the documented shapes exist: required files, permitted root files and directories, kebab-case names, and a definition extension matching its runes. |
| `graph` | `ClientModel` and `ServerModel` fields match what their builders return; every field is assigned once; leaves are constructed once; the root assembles in dependency order without cycles. |
| `lifetime` | Nothing constructs at module load; only an environment door holds a mutable module-scope binding or reaches `$app/*`; the client accessor guards on `browser`, and both accessors throw. |
| `environment` | Nothing browser-reachable imports `model/server`; no server module reaches `model/client`; every route reaching the client model sits beneath a layout exporting `ssr = false`. |
| `doors` | Object and environment boundaries are crossed at their doors; constructors are not reachable from consumers. |
| `methods` | A method directory is named for its entry and documents its tree; every documented path exists; sibling directories do not import one another; a shared method has at least two callers. |
| `tests` | Tests live under environment or object `test/` directories, in `unit/`, `regression/`, or `non-functional/`, with the extension their contents require. |
| `view-keys` | No model type names a Svelte `Component`, imports one, or sits in a `.svelte` file. |

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

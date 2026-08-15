# The Capability Directory

**Status:** The standard for capabilities in this application. Read it before
adding a capability, a public function, or a table.
**Document templates:** [`templates/`](templates/templates.md)

## What a capability is

A capability references data kept in a database, and it is **procedural**: types,
tables, and functions. It has no model object.

That is a deliberate narrowing from the version of this standard the backend
carried. A runtime object there held no state — it bound a store and a logger,
wrapped each call in instrumentation, and delegated. On a server handling many
users across several processes, per-request work is procedural, and the object
was ceremony. What it genuinely did is done better without it: infrastructure is
imported, and instrumentation is a shared procedure each entry calls, which no
caller can bypass the way a wrapper above the procedure could.

Objects survive where there is real lifetime, and that is not here. Browser state
and process-held resources live in [`$model`](../../src/lib/model), on their own
terms.

## The template

The template governs the leaf directory — the one that owns code. Directories
above it hold nothing but other directories.

```text
src/lib/capabilities/<group>/<capability>/
├── overview.md                  the capability's own document
├── index.server.ts             server door: procedures, for load functions and other capabilities
├── index.ts                    browser door: remote re-exports, for views
├── errors.ts                   error type + codes; part of the public contract
├── docs/                       supporting material belonging to no single directory
├── types/
│   ├── types.md
│   └── <aggregate>.ts  inputs.ts  results.ts
├── api/
│   ├── api.md
│   ├── shared/                 procedures a second function needs
│   │   ├── shared.md
│   │   ├── record.ts           instrumentation — every entry calls it
│   │   ├── stated.ts           a refusal reaches the browser; a fault does not
│   │   └── <procedure>.ts
│   └── <function>/
│       ├── <function>.md       carries the procedure tree
│       ├── <function>.ts       the entry; owns this function's whole procedure
│       ├── <function>.remote.ts    present ⇒ the browser may call it
│       ├── <supporting>.ts
│       └── <supporting>/       a procedure with sub-procedures of its own
│           ├── <supporting>.ts
│           └── <leaf>.ts
├── persistence/
│   ├── persistence.md
│   ├── tables.ts               Kysely table types + Database registration
│   ├── initialize.ts           DDL, and the schema drift check
│   └── stored-types.ts         row ↔ canonical conversion
└── test/
    ├── unit/                   mirrors the source directories it covers
    ├── regression/             one file per fixed defect
    └── non-functional/         performance, concurrency, resource behavior
```

**A directory is absent when the capability has nothing for it.** No placeholder
directories, no `.gitkeep`.

These names appear nowhere under `capabilities/`: `runtime-objects/`,
`runtime-api/`, `endpoints/`, `wire/`, `store.ts`, `queries.ts`, `definition.ts`,
`constructor.ts`, `domain/`, `application/`, `ports/`.

**`definition.ts` and `constructor.ts` are banned here and required in
[the model directory](../model-directory/model-directory.md).** That is not a
contradiction between the two standards, it is the difference they exist to mark:
a model object has state to define and dependencies to assemble, and a capability
has neither. Either filename appearing under `capabilities/` means something with
a lifetime was written as though it were procedural, which is the mistake worth
catching by name.

## Directory contracts

### The two doors

A capability has two public surfaces, reached differently, and they cannot be
merged. `index.ts` would otherwise import procedures and so Kysely; a view
importing the capability pulls that whole graph, and the framework's server-only
guard runs on the module graph at resolve time, so tree-shaking does not save it.

**`index.server.ts`** — reached by **import**, by server code: load functions,
form actions, and other capabilities. It exports the procedures, the public
types, and the error type.

**`index.ts`** — reached by **import**, by views. It re-exports remote functions
and nothing else. A view calls `capability.doThing(input)` and never learns a
wire exists.

A capability no view has reached yet has only `index.server.ts`.

### `api/`

**One directory per public function**, named after the function in kebab-case,
containing an entry file of the same name that owns that function's complete
procedure.

`api/` is a list of **functions**, not a mirror of anything. Most wrap a single
concern one-to-one. Some coordinate — calling several procedures, holding
intermediate state, returning one result. The set is designed, not derived.

**Nesting is recursive.** A supporting procedure with sub-procedures of its own
becomes a directory containing a `.ts` of the same name — the entry rule applied
at every depth. That is what keeps a supporting function out of the directory of
the function it supports.

**`api/shared/`** — a procedure is promoted here once a second function needs it.
Promotion means it preserves an invariant spanning functions, not merely that two
call sites wanted the same code.

### The same execution-tree rule as model methods

Capabilities already use the procedural nesting designed for model methods. The
names differ because the public surfaces differ; the ownership rule does not.

| Stateful model object | Procedural capability |
| --- | --- |
| `methods/<method>/` | `api/<function>/` |
| public method entry | public capability function entry |
| method-specific supporting method | function-specific supporting procedure |
| `methods/shared/` | `api/shared/` |
| method tree | procedure tree |

In both forms, opening the public operation reveals its execution flow. A helper
used only by that operation stays beneath it. A helper with its own flow becomes
a matching directory recursively. A second public caller forces an explicit
promotion to `shared/`; sibling operation directories never reach into one
another.

One asymmetry is intentional. Every capability function gets a directory and a
document even when its implementation is short, because it is an independently
auditable server API and may carry a browser boundary, admission rules, effects,
and failures. A simple model method may remain one file because its external
contract is already presented by the owning object. Only a model method whose
implementation has a supporting tree becomes a directory.

Capability lint already enforces recursive entry filenames and checks that paths
named in each documented procedure tree exist. It does not yet prove the actual
call graph matches the document or mechanically count callers before promotion;
those remain review checks and are the useful next enforcement improvements.

**SQL lives here, not in `persistence/`.** A query one function runs sits in that
function's directory; a query two functions run is promoted to `shared/` like any
other procedure. The generic query layer already exists and is called Kysely —
`db.selectFrom(table)` is the table interface, fully typed against `tables.ts`,
and a wrapper over it would either fail to express a real multi-row transactional
operation or grow parameters until it was a worse query builder.

### `<function>.remote.ts`

**Its presence means a boundary is crossed.** Absent means the function is
server-only — nothing to explain, no exception to record.

A remote file may export **only** remote functions: the framework's transform
assigns an id to every export, so a plain exported function throws at module
load. For the browser build the module body is discarded entirely and regenerated
as a fetch stub, which is why such a file may freely import the whole server
tree, and why it needs no `.server.` in its name.

Types flow through that regeneration, so the browser side is fully typed from the
server implementation. No wire type is written by hand.

### Scope and infrastructure

**Server-provided infrastructure is imported. Identity is an argument.**

Every procedure takes a `Scope` as its first parameter and its own input as the
rest. `Scope` is `{ projectId, userId }`, and a procedure that has one does not
check it: a `Scope` exists only because `resolveScope` produced one, and it
produces one only for a project the asking user holds a handle to.

Infrastructure divides by whether it depends on the caller.

| | Reached by | Why |
| --- | --- | --- |
| the logger | `record` resolves it itself | one per process |
| configuration | imported where read | one per process |
| **the project database** | `projectDatabase(scope.projectId)` | **one per project** — there is no import that could be correct |

`projectDatabase` lives on `$model/server/index.server`, the composition root
that holds the registry. It is the only scoped accessor, and a second scoped
object would get its own beside it rather than joining a bundle everyone then has
to grow a field for.

Keeping `projectId` and `userId` out of the input type is a security property
rather than tidiness. A remote request carries a **project token** — an opaque
handle a client instance holds in its URL — because a remote function cannot see
the page that called it: kit serves them all from `/_app/remote/…` with empty
route params. The token is resolved within the asking user's own handles, and one
that is not there resolves to no project at all. Below the wrapper the token no
longer exists.

### Admission

Remote functions are declared `'unchecked'`. The capability validates its own
input; a schema layer above it would restate what the procedure already enforces.

The consequence is explicit and belongs in `overview.md`: **every function with a
`.remote.ts` is directly reachable by an untrusted browser and owns validating
what it receives.** The set of files matching `api/*/*.remote.ts` is the audit
list.

### Two shared procedures every capability has

Both draw the same line — a **decision** this capability stated with a code is
not a **fault** — at the two places it has to be drawn.

**`api/shared/record.ts`** wraps the body of every entry. It is called *inside*
the procedure rather than around it, because a wrapper above a procedure can be
bypassed by anything reaching the procedure directly. A code is logged at `warn`;
anything else at `error`, so ordinary rejections never make real bugs harder to
find. Only names, shapes, and counts go in its fields — a log outlives the row it
describes.

**`api/shared/stated.ts`** wraps the body of every remote wrapper. Without it a
capability error thrown inside a remote function reaches the browser as
`500 Internal Error`, because kit hides thrown values and cannot tell one of ours
from a null dereference — leaving a view unable to distinguish "that input was
refused" from "the server is broken". It translates a code into a `400` carrying
it and lets faults stay opaque. **Only remote wrappers call it**; a server-side
caller catches the error class directly and has no use for a status.

### `types/`

The canonical model and the public contract. No Kysely row shapes — those are
`persistence/stored-types.ts`. Private model types live here too; the doors
decide what leaves.

### `persistence/`

**Tables, not queries.** `tables.ts` holds the Kysely table types and registers
them on the `Database` interface. `initialize.ts` creates them if absent and then
verifies them. `stored-types.ts` converts rows to canonical values and back.

**One database per project.** A project is its own database, so no query carries a
`project_id` predicate and no table carries the column. A capability that forgets
to scope *cannot* leak across projects, because there is no cross-project reach to
forget. The registry in `$model/server/persistence` opens a project's database
on first use and runs every capability's `initialize` against it.

The exception, where it arises, is data scoped to a **user** as well as a project.
That stays a column, and it belongs in the primary key rather than merely beside
it, so a write that omits it collides instead of quietly landing in another
user's row.

**`initialize.ts` verifies as well as creates.** `createTable().ifNotExists()` is
not a migration strategy — it creates when absent and does nothing when present,
so the first added column silently succeeds against an outdated database and
fails at query time. After creating, `initialize` introspects the columns
actually present and throws on drift, which converts a silent wrong answer into a
startup failure. Real migrations replace this later; the check buys time, not
correctness.

### `test/`

The capability owns its tests. `unit/` mirrors the source directories it covers,
`regression/` holds one file per fixed defect, `non-functional/` holds performance
and concurrency tests.

Tests run under vitest, which reuses the Vite config and therefore the alias map.
`node --test` cannot resolve a `$`-alias: Node resolves `package.json` imports,
whose keys must begin with `#`.

## Documentation is part of the structure

**Every directory carries a document named after itself, sitting inside it.** The
capability's own document is `overview.md`; below that, `types/types.md`,
`api/define/define.md`, and so on.

Exempt: everything under `test/`, `docs/` itself, and **nested procedure
directories** — a function's document carries the whole procedure tree, so a
document per sub-procedure would be noise.

`docs/` keeps only material belonging to no single directory: an algorithm
derivation, a revision model, a migration note. Anything describing what a
directory contains belongs in that directory.

### The procedure tree

Each function's document carries its call tree, and the tree is also the
directory layout:

```text
define(scope, input)
├── record()                      shared/record.ts
├── canonicalName(input.name)     shared/canonical-name.ts
├── canonicalType(input.type)     canonical-type/canonical-type.ts
│   ├── scalarField()             canonical-type/scalar-field.ts
│   └── listField()               canonical-type/list-field.ts
└── insert into name_manager_variables
```

Because it names real paths, a rename that does not update the tree is a
detectable defect rather than a stale comment.

## Naming and imports

- Every directory and `.ts` file is kebab-case. Compound extensions are checked
  per dot-separated segment, so `define.remote.ts` and `store.test.ts` are valid.
- An `api/<function>/` directory is the kebab-case form of the function it
  implements, and contains a file of the same name.
- **Every capability owns a direct alias.** `$name-manager` is its door;
  `$name-manager/...` reaches inside it. An alias arrives *with* its capability —
  a map full of forward declarations pointing at nothing is the rot this rule
  exists to prevent.
- **Cross-capability imports use the bare alias only.** Reaching into another
  capability's internals fails lint. This is the rule that makes "review one
  directory" true.
- Imports within a capability use its own subpath alias, so the grouping
  directory appears in no import. A capability can move between groups without
  touching a line of its own code.
- No relative imports anywhere.

Aliases are declared once, in `svelte.config.js` under `kit.alias`. The framework
generates the TypeScript paths from it, so the compiler and the bundler cannot
drift — there is no second map to keep in step.

One exception exists, and it is structural rather than stylistic: a
`declare module` block for Kysely declaration merging must name the module that
declares the interface, so a capability's `tables.ts` targets the persistence
object's types module rather than a door.

## Server-only enforcement

Two mechanisms, both failing the build with the full import chain: the path
`$lib/server/**`, and the basename pattern `*.server.*` anywhere in the project.

This standard relies on the second, so **`index.server.ts` is named exactly
that**. A bare `server.ts` matches neither pattern — the pattern requires a dot
before `server` — and a directory merely *named* `server` deeper in the tree
buys nothing.

**Mark the door, not every file.** A capability marks `index.server.ts` and
leaves `api/` and `persistence/` unmarked, because the bare-alias rule already
forbids reaching past the door. What that leaves uncovered is a deliberate
deep-import of an internal, which still fails the build — Node built-ins cannot
be bundled for a browser — just with a worse message.

## Reviewing

[`reviewing-a-capability.md`](reviewing-a-capability.md) is the checklist. Its
first section is machine-checked, so a green `pnpm lint` lets a reviewer skip to
the judgment items: whether a document says anything, whether a `shared/`
procedure really has two callers, whether a `.remote.ts` should exist at all.

# The Capability Directory

> **Stale. Do not build against it.** `src/lib/capabilities/` is empty and there
> is no store. Sections on the two doors, remote wrappers, admission, and storage
> describe a shape nothing currently has.
>
> What still holds is everything about organizing functions: one directory per
> capability, the recursive entry-filename rule, promotion to `shared/` on a
> second caller, the procedure tree that names real paths, and a document per
> directory.
>
> Rewritten against Convex once a capability exists on Convex — a standard
> written for a shape nobody has used is a guess.

**Document templates:** [`templates/`](templates/templates.md)

## What a capability is

A capability references stored data, and it is **procedural**: types and
functions. It has no model object.

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

**A capability sits directly under `capabilities/`, named for itself.**

Grouping directories were tried and dropped. Because every import a capability
writes goes through its own alias, the directory above it never appeared in a
line of its own code — which made a group free to add and equally free to remove,
and left it earning nothing but a level of nesting and an argument about which
group a new capability belongs in. The flat list is the whole set, and reading it
is how you learn what this application can do.

```text
src/lib/capabilities/<capability>/
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
merged. `index.ts` would otherwise import procedures and so the whole server
graph; a view importing the capability pulls it in, and the framework's
server-only guard runs on the module graph at resolve time, so tree-shaking does
not save it.

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

**Reads and writes live here.** One a single function runs sits in that
function's directory; one two functions run is promoted to `shared/` like any
other procedure. There is no store object and no query layer between a procedure
and what it stores: a wrapper over the store's own interface would either fail to
express a real multi-record transactional operation or grow parameters until it
was a worse version of the thing it wrapped.

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

Both are one per process, so both are imported. Anything that varies with the
caller cannot be — there is no import that could name the right one — so it is
reached through an accessor on `$model/server/index.server` taking what it varies
by. Each such accessor gets its own name rather than joining a bundle everyone
then has to grow a field for.

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

The canonical model and the public contract. No stored row shapes — a stored
shape is a storage decision, and keeping it out is what stops a change in where
data lives from reaching the public contract. Private model types live here too;
the doors decide what leaves.

### Storage

A capability has no storage directory. Two rules apply to whatever it stores:

**A stored shape is converted at the boundary**, so a storage decision cannot
leak into `types/`. That boundary is also where a retired representation is
rewritten on read, which retires it without rewriting every record.

**Schema disagreement is a deploy failure, not a query-time one.** A store that
accepts a write against a shape it was not declared with fails much later and far
from the cause.

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
- Imports within a capability use its own subpath alias, so where the capability
  sits appears in no import. It can be moved or renamed without touching a line of
  its own code — which is also why it needs no grouping directory to make it
  relocatable.
- No relative imports anywhere.

Aliases are declared once, in `svelte.config.js` under `kit.alias`. The framework
generates the TypeScript paths from it, so the compiler and the bundler cannot
drift — there is no second map to keep in step.

One exception is structural rather than stylistic: a `declare module` block for
TypeScript declaration merging must name the module that *declares* the
interface, never a door that re-exports it. That is a language rule, so a
capability registering itself by declaration merging targets the declaring module
directly.

## Server-only enforcement

Two mechanisms, both failing the build with the full import chain: the path
`$lib/server/**`, and the basename pattern `*.server.*` anywhere in the project.

This standard relies on the second, so **`index.server.ts` is named exactly
that**. A bare `server.ts` matches neither pattern — the pattern requires a dot
before `server` — and a directory merely *named* `server` deeper in the tree
buys nothing.

**Mark the door, not every file.** A capability marks `index.server.ts` and
leaves `api/` unmarked, because the bare-alias rule already forbids reaching past
the door. What that leaves uncovered is a deliberate
deep-import of an internal, which still fails the build — Node built-ins cannot
be bundled for a browser — just with a worse message.

## Reviewing

[`reviewing-a-capability.md`](reviewing-a-capability.md) is the checklist. Its
first section is machine-checked, so a green `pnpm lint` lets a reviewer skip to
the judgment items: whether a document says anything, whether a `shared/`
procedure really has two callers, whether a `.remote.ts` should exist at all.

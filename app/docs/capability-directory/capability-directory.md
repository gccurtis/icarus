# The Capability Directory

**Status:** The standard for capabilities on Convex. Read it before adding a
capability, a public function, or a table.
**Document templates:** [`templates/`](templates/templates.md)

## What a capability is

A capability references stored data, and it is **procedural**: types and
functions. It has no model object, and it has no door.

Objects survive where there is real lifetime, and that is not here — a Convex
function receives its context and returns. Browser state lives in
[`$model`](../../src/lib/model), on its own terms.

## A capability is written across two trees

This is the one thing to understand before anything else, because every other
rule follows from it.

**A Convex module's path is its public name.** `src/convex/capabilities/settings.ts`
exporting `list` *is* `api.capabilities.settings.list`, callable by anything that
knows the deployment URL. So where a file sits is an API decision, and moving one
is a breaking change.

That forces the split:

| | Lives in | Because |
| --- | --- | --- |
| **Handlers, types, tables** | `src/lib/capabilities/<name>/` | a module under the functions directory that merely exports something becomes addressable; procedures must not be reachable by accident, and `test/` must not be pushed at all |
| **Registrations** | `src/convex/capabilities/<name>.ts` | a module only becomes a callable function by sitting there |

The registration file is the capability's **entire public surface**, and it is
the audit list: one directory holds every function an untrusted caller can reach,
and lint checks it against `api/` in both directions.

This is also Convex's own guidance — the public API "should have very short
functions that mostly just call into" code held elsewhere. The departure is
keeping that code out of the functions directory rather than in a `convex/model/`
beside it, which is what keeps non-functions unaddressable.

## Every function is gated

`projectQuery` and `projectMutation` in
[`$convex/functions`](../../src/convex/functions.ts) are the only things that
build a registration, and `src/convex/functions.ts` is the only module that
imports `query` or `mutation`.

A Convex function is public the moment it is registered, and there is no request
pipeline for a middleware to sit in. So "is this call allowed" lives in what the
function is *made of*. A bare `query(...)` anywhere else is a defect, and lint
says so.

The wrapper declares `projectToken`, resolves it against the caller's own
memberships, and **consumes it** — the handler's argument type has no project in
it at all. A handler receives `ctx.scope`, and a handler holding one does not
check it: a `Scope` exists only because the gate produced one.

A capability that legitimately has no project registers with `query`/`mutation`
directly and says why in its `overview.md`. Today exactly one does — `access`,
whose `seed` creates the first membership the gate resolves against. That should
read as unusual.

## The template

**A capability sits directly under `capabilities/`, named for itself.**

Grouping directories were tried and dropped. Because every import a capability
writes goes through its own alias, the directory above it never appeared in a
line of its own code — which made a group free to add and equally free to remove,
and left it earning nothing but a level of nesting and an argument about which
group a new capability belongs in. The flat list is the whole set, and reading it
is how you learn what this application can do.

```text
src/convex/capabilities/<camelCase>.ts   the public surface: every registration
src/lib/capabilities/<capability>/
├── overview.md                  the capability's own document
├── schema.ts                    its table fragments; absent when it stores nothing
├── errors.ts                    ConvexError subclass + codes; absent when it states no refusals
├── docs/                        supporting material belonging to no single directory
├── types/
│   ├── types.md
│   └── <aggregate>.ts  inputs.ts  results.ts
├── api/
│   ├── api.md
│   ├── shared/                 procedures a second function needs
│   │   ├── shared.md
│   │   └── <procedure>.ts
│   └── <function>/
│       ├── <function>.md       carries the procedure tree
│       ├── <function>.ts       the handler; owns this function's whole procedure
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

### The deployment door

`src/convex/capabilities/<camelCase>.ts`. It holds a registration per public
function and nothing else.

**Names there are camelCase**, alone in a kebab-case repository, because Convex
rejects a hyphen in a module path — `name-manager` is `nameManager.ts` and answers
to `api.capabilities.nameManager.*`.

**A registration is written, never re-exported.** Codegen types a real
`projectQuery({...})` definition properly; a re-export through a path alias can
degrade the generated API to `AnyApi`. It is also where the `args` validator
lives, which is the security boundary for a public function — the shape is
checked at the door, and canonicalization stays with the handler that owns the
invariant.

A view imports `api` from `$convex/_generated/api` and subscribes. It never
imports the capability.

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

### Scope

**Identity is never an argument.**

Every handler takes a context first — a Convex `QueryCtx` or `MutationCtx`, with
`ctx.scope` on it — and its own input as the rest. `Scope` is
`{ projectId, userId }`, and a handler holding one does not check it.

A caller sends a project **token**, not a project id: an opaque handle they hold
for that project, in their URL. `resolveScope` looks it up in
`memberships.by_user_and_token` with the *user* leading, so a copied URL lands in
someone else's key range and finds nothing. The lookup is the authorization, and
there is no separate membership check to forget.

Keeping the project out of the input type is that property, not tidiness. The
gate consumes the token, so the handler's argument type has no project in it to
read, shadow, or forward.

Configuration and anything else one-per-process is imported where it is read.
Anything varying with the caller arrives on `ctx`.

### Errors

`errors.ts` holds a `ConvexError` subclass and its codes. A capability that
states no refusals does not have one.

**Convex draws the refusal/fault line itself.** A thrown `ConvexError`'s payload
is serialized to the caller; anything else is redacted to an opaque server error.
So a code reaches a view intact and a null dereference does not, and no wrapper
has to translate anything — which is why there is no `stated.ts` and no
per-entry instrumentation procedure.

**A refusal should not disclose.** `access` answers "no such project" identically
whether the project is absent or merely someone else's, because distinguishing
them would confirm it exists.

### `types/`

The canonical model and the public contract. No stored row shapes — a stored
shape is a storage decision, and keeping it out is what stops a change in where
data lives from reaching the public contract. Private model types live here too;
what leaves is what a handler returns.

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
define(ctx, scope, input)
├── canonicalName(input.name)     shared/canonical-name.ts
├── canonicalType(input.type)     canonical-type/canonical-type.ts
│   ├── scalarField()             canonical-type/scalar-field.ts
│   └── listField()               canonical-type/list-field.ts
└── ctx.db.insert("name_manager_variables", …)
```

Because it names real paths, a rename that does not update the tree is a
detectable defect rather than a stale comment.

## Naming and imports

- Every directory and `.ts` file is kebab-case. Compound extensions are checked
  per dot-separated segment, so `store.test.ts` is valid.
- **Except the deployment door**, which is camelCase because Convex rejects a
  hyphen in a module path.
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

## What is no longer enforced by the framework

SvelteKit fails a build when a browser-reachable module imports one whose
basename matches `*.server.*`. Nothing under `src/convex/` carries that marker,
so **a view importing a capability's handler, or the deployment root, is caught
by lint and by nothing else.**

That is a genuine loss and worth knowing rather than assuming. Two things reduce
it: `_generated/api` is the only import a view has any reason to reach for, and
it exports function *references* rather than implementations, so the ordinary
path is also the safe one.

## Reviewing

[`reviewing-a-capability.md`](reviewing-a-capability.md) is the checklist. Its
first section is machine-checked, so a green `pnpm lint` lets a reviewer skip to
the judgment items: whether a document says anything, whether a `shared/`
procedure really has two callers, whether a function should be public at all.

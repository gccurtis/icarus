# Capability Integration — One Procedural SvelteKit Application

**Date:** 2026-08-13
**Scope:** the whole repository — `apps/backend`, `apps/frontend`, and the root
**Status:** **Implemented**, all six phases. `apps/backend` is deleted and
`apps/frontend` is now `app/`. The living standard is
[`app/docs/capability-directory/capability-directory.md`](../../../app/docs/capability-directory/capability-directory.md);
this file is the record of what was decided and why.

**Three decisions here were reversed while building.** Each is recorded at the
section it contradicts, and collected once below.

| This document said | What was built | Why |
| --- | --- | --- |
| `apps/` dissolves and the app is promoted to the repository root | a single **`app/`** directory | the package moves whole, so every lint and generation script's `dirname()` depth and both `process.cwd()` derivations keep working untouched |
| capabilities live at `<group>/<capability>` | **flat** — `capabilities/<capability>` | the group never appeared in a line of a capability's own code, because every import goes through its own alias. It was free to add and equally free to remove, and earned nothing but nesting |
| `require` gets no remote wrapper | **every** public function has one | the get/require choice belongs to the caller, and a browser that could only reach `get` would reimplement `require` each time it needed it |

The first was a change of instruction; the other two were decided during
implementation. The capability standard, the generator, and its tests were
updated to match, and `data/settings` was flattened to `settings` so the tree is
consistent.
**Supersedes:**
[`2026-08-13-capability-directory-template-design.md`](2026-08-13-capability-directory-template-design.md).
Its template established the vocabulary this design keeps — `types/`,
`persistence/`, one directory per public method, a document per directory — and
its two halves that do not survive are `endpoints/` and `runtime-objects/`.

## Problem

Icarus is two applications. `apps/backend` is a Fastify service holding eight
capabilities on a strict template enforced by seventeen rules. `apps/frontend` is
a SvelteKit SPA holding four capabilities on no template, enforced by nothing.

The split costs more than it buys. The wire contract is unchecked in both
directions — `ApiHealth` is declared on each side and no compiler compares them.
Every server capability needs an endpoint before a view can reach it: a
directory, a job, three wire files, a registration line, and a Bruno request, all
restating a method that already exists. And two processes must run for anything
to work.

SvelteKit already runs a server. Everything the endpoint layer does — receive a
call, decode it, invoke a capability, return a result — it does natively, with
types flowing across the boundary instead of being restated on each side.

Removing endpoints exposed a second, larger finding. Once a capability's public
surface is a set of functions rather than an HTTP table, its runtime object turns
out to hold no state: `PersistedNameManager` binds `(store, logger)`, wraps calls
in instrumentation, and delegates. There is no identity and no lifetime. On a
server that handles many users across several processes, per-request work is
procedural, and the object was ceremony.

## Goals

- One application, one dependency tree, one lockfile.
- **Capabilities are procedural.** A capability is types, tables, and functions.
- **Runtime objects exist only where there is real lifetime** — browser state, and
  process-held resources.
- A view reaches a capability by calling a function. No endpoints, no wire types,
  no hand-written client.
- Project isolation is structural, not a predicate every query must remember.
- Structure violations keep failing `pnpm lint` rather than review — on both
  halves of the codebase for the first time.

## Non-goals

- **View organization.** Deferred entirely. The integration must leave views able
  to reach capability data; it must not design them.
- **Authentication.** Users, projects, membership, and sign-in are post-integration.
  This design fixes the seam and stubs the resolver.
- **Real migrations.** The introspection check below buys time. Kysely's
  `Migrator` comes later.
- **Live update fan-out.** Correctness under concurrency is covered by CAS, which
  rich-content already implements. Notifying one client of another's write is
  post-integration.
- **A testing pass.** The existing tests are ported so they keep running. Writing
  the tests the frontend never had is separate.
- **TanStack.** Dropped — remote functions already dedup, cache, and refresh.

## What the platform provides

Verified against `@sveltejs/kit` 2.70.2, `kysely` 0.29.5, and
`@electric-sql/pglite` 0.5.4 as installed. These are the load-bearing facts.

**`adapter-static` cannot run server code.** It becomes `adapter-node`. The one
part of this with no alternative.

**Remote functions are gated and available.** `kit.experimental.remoteFunctions`
defaults to `false`. `query`, `query.live`, `command`, `form`, and
`getRequestEvent` come from `$app/server`.

**A `.remote.ts` file may export only remote functions.** The SSR transform loops
over every export assigning `fn.__.id`, so a plain exported function throws at
module load. This is why a procedure and its remote wrapper are two files.

**The client never sees a remote file's body.** For the browser build kit
discards the module and regenerates it as
`export const list = __remote.query('<hash>/list')`. A `.remote.ts` may import
the whole server tree freely — none of it enters the client graph — while types
still flow, so the browser side is fully typed from the server implementation.

**A query is a Promise that is also reactive.** `RemoteQuery<T>` is
`Promise<T> & { current, loading, ready, error, refresh(), set(), withOverride() }`.
`await capability.method()` behaves like the server function; a component can
bind to `.current` instead. `query.live` adds `AsyncIterable<T>` and `connected`.

**Server-only enforcement has two mechanisms**, both failing the build with the
import chain: the path `$lib/server/**`, and the basename pattern `*.server.*`
anywhere in the project. This design uses the second. A bare `server.ts` matches
neither — the pattern needs a dot before `server` — so the door is
`index.server.ts`.

**PGlite is single user/connection**, being Postgres compiled to WASM in single
user mode. One instance is one database is one directory. This shapes project
isolation below.

**Kysely exposes introspection.** `db.introspection.getTables()` returns column
names, data types, nullability, and defaults — enough to verify a table on disk
matches the table the code expects.

## The model

Three layers. The boundary between the first two is the subject of this design.

| Layer | Location | Status |
| --- | --- | --- |
| Model | `src/lib/capabilities/**` and `src/lib/runtime/**` | This integration |
| View | components | Deferred, deliberately |
| Controller | `src/routes/**` | SvelteKit's, already solved by layouts |

```text
src/lib/
├── capabilities/     procedural. A capability references data kept in a database
│   └── <group>/<name>/
└── runtime/          objects, because they have real lifetime
    ├── client/       browser state — identity, $state, lives across interactions
    └── server/       process resources — database registry, logger, configuration
```

```text
browser runtime object ──▶ capability remote API ──▶ capability procedure ──▶ server runtime object
     $state, identity          3-line wrapper           the actual work         database, logger
```

Acyclic. A capability procedure never reaches a browser object; a browser object
never reaches a procedure except through its remote form.

**Why capabilities are procedural.** A runtime object on the server held no
state — it bound dependencies and wrapped calls. Both of those are better done
without it: configuration, the logger, and the database registry are imported,
because they are ambient process infrastructure; instrumentation is a shared
procedure each entry calls, which no caller can bypass the way a wrapper above
the procedure can. What remains of the old object — an interface and a class that
curry two arguments — is not worth a directory.

**Why runtime objects survive where they do.** A browser session has identity and
lives across hundreds of interactions. A database registry and a logger are
constructed once, held, and closed. Those are objects. Rows are not.

## The capability template

```text
src/lib/capabilities/<group>/<capability>/
├── overview.md
├── index.server.ts             procedures — for load functions and other capabilities
├── index.ts                    remote re-exports — for the browser
├── errors.ts
├── docs/
├── types/
│   ├── types.md
│   └── <aggregate>.ts  inputs.ts  results.ts
├── api/
│   ├── api.md
│   ├── shared/
│   │   ├── shared.md
│   │   ├── record.ts           instrumentation — each entry calls it
│   │   └── <procedure>.ts      promoted once a second entry needs it
│   └── <function>/
│       ├── <function>.md       carries the procedure tree
│       ├── <function>.ts       the entry; owns the whole procedure
│       ├── <function>.remote.ts    present ⇒ crosses the boundary
│       ├── <sub-procedure>.ts
│       └── <sub-procedure>/    a procedure with sub-procedures of its own
│           ├── <sub-procedure>.ts
│           └── <leaf>.ts
├── persistence/
│   ├── persistence.md
│   ├── tables.ts               Kysely table types + Database registration
│   ├── initialize.ts           DDL, and the schema check
│   └── stored-types.ts         row ↔ canonical conversion
└── test/
    └── unit/  regression/  non-functional/
```

`runtime-objects/` and `endpoints/` are absent from the vocabulary — not
optional, gone. `runtime-api/` becomes `api/`, since there is no longer a runtime
object for it to be the API of.

**Nesting is recursive.** A procedure with sub-procedures of its own becomes a
directory containing a `.ts` of the same name — the method-directory rule applied
at every depth. That is what keeps a supporting function out of the directory of
the function it supports.

**There is no `queries.ts`.** SQL lives in the procedure that runs it, or in
`api/shared/` once a second procedure needs it — the existing promotion rule,
applied to queries like anything else. The generic query layer already exists and
is called Kysely; `db.selectFrom(table)` is the table object, fully typed against
`tables.ts`, and a wrapper over it would either fail to express rich-content's
`replaceManyWithOne` or grow parameters until it was a worse query builder.

### The procedure tree

Each entry's document carries its call tree, which is also its directory layout:

```text
define(scope, input)
├── record()                      shared/record.ts
├── canonicalName(input.name)     shared/canonical-name.ts
├── canonicalType(input.type)     canonical-type/canonical-type.ts
│   ├── scalarField()             canonical-type/scalar-field.ts
│   └── listField()               canonical-type/list-field.ts
├── canonicalValue(type, value)   canonical-value/canonical-value.ts
│   └── valueGuards()             canonical-value/value-guards.ts
└── insert into name_manager_variables
```

Because it names real paths, lint checks that every path resolves — a rename that
does not update the tree fails. Nested procedure directories are **exempt from
the document-per-directory rule**: the tree already describes the whole subtree,
and a document per procedure would be noise.

### The two doors

They cannot be merged. `index.ts` would import procedures and so Kysely; a view
importing the capability pulls that graph, and kit's guard runs on the module
graph at resolve time, so tree-shaking does not save it.

```ts
// index.server.ts — server callers
export { define } from "$name-manager/api/define/define";
export { list }   from "$name-manager/api/list/list";
export type { NamedVariable } from "$name-manager/types/variables";
export { NameManagerError } from "$name-manager/errors";

// index.ts — the browser. Re-exports of remote functions, nothing else.
export { define } from "$name-manager/api/define/define.remote";
export { list }   from "$name-manager/api/list/list.remote";
```

A browser-only module has no `index.server.ts`. A capability no view has reached
yet has no `index.ts`.

### Both call forms exist

A `+page.server.ts` load and a capability-to-capability call invoke the procedure
**directly**; the remote form needs a request store and would round-trip HTTP to
its own process.

```ts
// api/define/define.ts — the procedure. Both callers land here.
import { databaseFor } from "$runtime/server/persistence";
import { logger } from "$runtime/server/observability";

export const define = async (scope: Scope, input: NamedVariableInput): Promise<NamedVariable> =>
  record(logger, "define", { name: input.name }, async () => {
    const db = await databaseFor(scope.projectId);
    …
  });

// api/define/define.remote.ts — three lines, browser only
import { command, getRequestEvent } from "$app/server";
export const define = command('unchecked', async (input: NamedVariableInput) =>
  defineProcedure(await scopeFor(getRequestEvent()), input));
```

### Admission

Remote functions are declared `'unchecked'`; the capability validates its own
input, as `define`'s admission tree already does at length. Every function with a
`.remote.ts` is directly reachable by an untrusted browser and **owns validating
what it receives** — an obligation recorded in each capability's `overview.md`,
with `api/*/*.remote.ts` as the audit list.

**Scope is never part of that input.** The browser's payload has no slot for
`projectId` or `userId`; the wrapper derives them server-side. Were scope a field
on the input type, a client could name any project and every procedure would have
to remember to overwrite it.

## Runtime objects

```text
src/lib/runtime/
├── client/
│   └── <object>/
│       ├── <object>.md
│       ├── types.ts
│       ├── definition.svelte.ts    class holds $state
│       └── constructor.ts          create<Object>()
└── server/
    ├── scope.ts                    the auth seam
    └── <object>/
        ├── <object>.md
        ├── types.ts
        ├── definition.ts
        └── constructor.ts
```

`configuration`, `observability`, and `persistence` leave `capabilities/` for
`runtime/server/` — they own process-lifetime resources and `close()`. The four
browser modules go to `runtime/client/`, two of them renamed:

| Today | Becomes | Why |
| --- | --- | --- |
| `session` | **`workbench`** | `session` collides with an authentication session. `tabs` is too narrow — this is the coordinating state every zone reads and writes: what is open, which is active, and what is inspected within it. `workbench` is the established name for exactly that. `focus` was rejected because `types.ts` already distinguishes inspection from DOM focus, and the name would mislead |
| `workspace` | **`preferences`** | What it holds is persisted settings — panel widths, and later theme and semantic set. `workspace` is too large a name for that, and is wanted for the whole screen |
| `context` | unchanged | |
| `inspector` | unchanged | |

`runtime/client/` is itself the grouping, so these four need no further group.

**Constructors, not module singletons.** With SSR on, module state on the server
is shared across every request, so one user's open tabs would reach another. Each
client object is constructed in the root layout and passed by context. This is
required as of Phase 1, not optional.

`context` and `inspector` stay pure runtime objects with no capability behind
them — `context` projects which activity is active for the current resource kind,
and `inspector` holds a view registry. Neither persists anything.

`workbench` and `preferences` persist, but **not to the database** — they persist
browser-side, so neither has a capability behind it either. All four are objects
and nothing more.

The reasoning: tabs and panel widths are user data that *references* a project,
not project data that references a user. Putting them in a project database would
mean deleting a user requires visiting every project they belonged to, and
exporting a project carries other members' personal state along with it. Putting
them in a user-scoped database would fix that at the cost of a third database
kind, a multiplied PGlite instance count, and an `initialize` per user. For tabs
and widths, neither is worth it — the browser is the natural home, and
cross-device continuity can be added later without changing the objects.

**Browser storage is itself a runtime object.** `runtime/client/storage/` owns
reading and writing, exactly as `runtime/server/persistence` owns the database.
It is treated like everything else — a document, a definition, a constructor —
rather than being an inline detail scattered through two objects. That is also
what makes the mechanism swappable: cookie today, `localStorage` or a
user-scoped table later, without `workbench` or `preferences` changing.

**It uses a cookie.** With SSR on, a client object's constructor runs on the
server too, where `localStorage` does not exist — so the server would render
default widths and the panels would visibly snap on hydration. A cookie is
readable server-side, so the first paint is correct, and it is not more work once
the storage object exists: the root `+layout.server.ts` reads it, the layout
constructs the objects with those values, and the object writes back through
`document.cookie`. Panel geometry is a few bytes and a tab list a few hundred,
far inside the 4KB limit.

**The general rule still holds for anything database-backed:** the browser cannot
reach a database, so a database-persisted browser object is always a pair — an
object in `runtime/client/` and a capability owning its table. Nothing exercises
that yet.

**Structure enforcement for `runtime/**` is post-integration.** A runtime object
will have types, a definition, methods, and supporting procedures, and the shape
those settle into is not yet known — so the lint rewrite covers
`capabilities/**` thoroughly and leaves this tree to convention rather than
guessing at rules it would then have to unpick.

One convention does hold from the start, because it is a build-time guarantee
rather than a style: **a server module's door carries `.server.ts`; internals do
not.** `src/lib/runtime/server/` is not `$lib/server/`, so kit's path guard does
not cover it and the directory name protects nothing — only the `*.server.*`
basename pattern does. `persistence/index.server.ts` is what a component could
reach, so that is what carries the marker, exactly as a capability marks its
index and leaves `api/` alone.

### Interaction mechanics belong to components, not objects

Today the `context` runtime object owns geometry mechanics — it exports
`COLLAPSE_AT`, `CONTENT_MIN`, `CONTENT_MAX`, and `RAIL_WIDTH`, and `resize(width)`
decides whether a drag clamps to the minimum or collapses the panel.

That moves into the panel components. The component is the thing that knows a
drag overshot, so it owns the thresholds and the decision; the object stores only
the values the component hands it.

Two consequences, both simplifications:

- **`preferences` holds no logic at all** — widths, and a collapsed boolean if the
  component chooses to persist one. That is what makes it the right size for the
  name.
- **`context` loses its geometry half entirely**, leaving the activities
  projection as its whole job.

## Project isolation

**One database per project.** `runtime/server/persistence` holds a registry
keyed by project, opening a project's database on first use and running every
capability's `initialize` against it.

This is stronger than a `project_id` predicate and simpler at every call site:

- **Queries carry no project predicate.** `where("project_id", "=", …)`
  disappears from every statement.
- **`name_manager_variables` loses its `project_id` column**, and its composite
  primary key `(project_id, name_key)` becomes `name_key`. `definition_order` is
  naturally per-project.
- **`rich_content`'s missing scope stops being a defect.** It has no `project_id`
  column today, which under one user is invisible and under many means content
  belongs to nobody. Per-project databases make it structurally scoped, so
  nothing needs adding.
- **A capability that forgets to scope cannot leak across projects**, because
  there is no cross-project reach to forget.

Under PGlite a project is a directory. Under Postgres later it becomes a schema
or a database; the registry is the only code that changes.

Two consequences to hold:

**Each open project is a live PGlite instance**, and PGlite is Postgres in WASM.
Memory scales with concurrently open projects, so the registry needs an eviction
policy before many projects are open at once. Not now, but not never.

**Anything spanning projects needs a separate control database** — users,
projects, membership, and the route tokens below. It arrives with authentication;
the registry is written anticipating it.

### Schema initialization and the drift check

`initialize.ts` per capability, collected by the persistence runtime object:

```ts
// runtime/server/persistence/constructor.ts
import { initializeNameManager } from "$name-manager/persistence/initialize";
import { initializeRichContent } from "$rich-content/persistence/initialize";

for (const initialize of [initializeNameManager, initializeRichContent]) {
  await initialize(db);
}
```

Each `initialize` creates its tables if absent **and then verifies them**:
`db.introspection.getTables()` reports the columns actually present, and a
mismatch against the expected set throws at startup.

This matters because `createTable().ifNotExists()` is not a migration strategy —
it creates when absent and does nothing when present, so the first added column
silently succeeds against an outdated database and fails at query time. The
check converts that into a loud startup failure. While the schema is still
moving and databases are cheap to delete, that is enough; real migrations are
post-integration.

## Scope and identity

**Server-provided infrastructure is imported. Client-supplied identity is an
argument.** Procedures import the database registry, logger, and configuration;
they receive `Scope` and their own input.

```ts
export type Scope = { projectId: string; userId: string };
```

Scope resolves from a **route parameter** — `/[project]/…`, whose value is the
opaque token rather than the id it resolves to — so switching
project is a navigation: loads re-run and there is no invalidation logic to
forget.

The parameter is an **opaque random token**, not an id and not a derived hash. A
value derived from the project id is guessable from low-entropy inputs; the token
is a `crypto.randomUUID()` stored on the membership row, unguessable by
construction and revocable by rotating one row.

Resolution is `(sessionUserId, urlToken) → projectId`, scoped by the
authenticated user, so **the lookup is the authorization check** — a miss is a
404, and there is no separate membership check that can be omitted. The user id
stays in the session and never appears in a URL.

None of this exists yet. `$lib/runtime/server/scope.ts` ships returning the
configured project and a fixed demo user. One function changes when
authentication lands, and the route shape is already correct.

## Repository

**Reversed — see the header.** What was built keeps one directory level:

```text
icarus/
├── app/
│   ├── src/
│   │   ├── lib/capabilities/       procedural, flat — no group directories
│   │   ├── lib/model/{client,server}/
│   │   ├── lib/styles/  lib/simple-components/  lib/shell/  lib/views/
│   │   ├── routes/
│   │   ├── hooks.server.ts
│   │   └── app.d.ts                App.Locals
│   ├── scripts/{lint,generation}/  four linters, five generators
│   ├── docs/                       capability, model, view, style standards
│   ├── configuration/              YAML
│   ├── data/projects/<project>/    one PGlite directory per project
│   └── package.json  svelte.config.js  vite.config.ts  tsconfig.json
├── docs/                           repository-level design records
├── infra/  reference/
└── README.md
```

`apps/` still dissolves — there is one application, so a directory holding one
thing named after a half it no longer is earns nothing. What changed is that the
application keeps a name of its own rather than becoming the root: the package
then moves **whole**, and every script's `dirname()`-counted package root and
both `process.cwd()` path derivations keep working without a line of change.

`runtime/` became `model/` separately, before this phase.

## Aliases

`#name-manager` becomes `$name-manager`, declared once in `kit.alias`. Kit
generates `.svelte-kit/tsconfig.json` paths from it, so **there is one map** —
which deletes the check that `package.json` imports and `tsconfig.json` paths
agree, because there is no second map to disagree with.

Surviving: no relative imports, cross-capability imports use the bare alias only,
and every alias specifier a file actually imports resolves on disk.

## Lint

| Rule | Change |
| --- | --- |
| Capability directories | `docs`, `types`, `api`, `persistence`, `test`. `runtime-objects` and `endpoints` gone |
| Root files | `overview.md`, `index.ts`, `index.server.ts`, `errors.ts` |
| `persistence/` contents | `persistence.md`, `tables.ts`, `initialize.ts`, `stored-types.ts` |
| `api/` entries | **Recursive** — every directory under `api/` holds a `.ts` named after it. `<fn>.remote.ts` permitted at a top-level function directory |
| Public surface | `index.server.ts` exports ⇄ `api/` top-level directories. No interface to parse, so the check is simpler than the one it replaces |
| Remote shape | A `<fn>.remote.ts` exports exactly one remote function, named for its directory |
| Documents | Unchanged, except nested procedure directories are exempt |
| **new** | Every path named in a procedure tree resolves on disk |
| **new** | `index.ts` may import only `.remote.ts` files |
| **new** | `runtime/**` — a runtime object is `<object>.md`, `types.ts`, `definition[.svelte].ts`, `constructor.ts` |
| **widened** | The `import.meta.url` ban covers `import.meta.resolve`, which slips past it today |
| **deleted** | The two-alias-map agreement check, obsoleted by the single map |

The rule that read a runtime object's interface to require one directory per
method is replaced rather than lost: `index.server.ts` is now the declared public
surface, and it is a barrel file, which is easier to parse than an interface
block.

## Generators

- `new-capability <path>` writes `overview.md`, `index.server.ts`, `errors.ts`,
  `types/`, `api/api.md`, and `test/`. `--persisted` adds `persistence/`;
  `--browser-facing` adds `index.ts`.
- `new-api <capability> <function>` writes the function directory, its document
  with an empty procedure tree, and its entry. `--remote` adds the wrapper and
  the `index.ts` re-export.
- `new-endpoint` is deleted, with the `endpoint.md`, `endpoint-procedures.md`,
  and `endpoints.md` templates.
- New template: the procedure tree.

## Deleted

| | Why |
| --- | --- |
| `platform/web-server` | SvelteKit is the web server |
| `built-in/` | The only capability with `endpoints/`. Echo goes; health becomes a route |
| `src/runtime/registry.ts`, `server-options.ts` | An endpoint table with no endpoints |
| `src/main.ts` | Replaced by `hooks.server.ts`; `shutdown.ts` survives |
| Fastify | Its only consumer was `web-server` |
| `test/bruno/**` | Exercised endpoints over HTTP |
| Every runtime object in a capability | The subject of this design |
| `apps/backend/` entirely | After Phase 5 |

## Known breakages

**Three path derivations use `import.meta.resolve`** — the YAML directory, the
log directory, and the PGlite data directory. Under Vite bundling these resolve
into `build/server/chunks/`, and they break *silently*, because a wrong directory
is still a valid path. They must resolve from the working directory or explicit
configuration. Lint does not catch them today, which is why the rule widens.

**Nineteen test files import `node:test`.** `node --test` resolves
`package.json` imports, whose keys must begin with `#`; kit aliases are
Vite-only. Once `#name-manager` becomes `$name-manager`, `node --test` cannot
resolve anything. The tests move to vitest, which reuses the Vite config and
therefore the alias map — one line per file, since `node:assert/strict` runs
unchanged. This is keeping the lights on, not the testing pass.

They distribute as: **1** with `observability` (Phase 3), **6** with
`name-manager` and **11** with `rich-content` (Phase 5), and **1** that dies with
`web-server` — its `register-transport` test covers a Fastify translation layer
that no longer exists. Two of the survivors, `name-manager/persistence/store` and
`rich-content/persistence/store`, currently exercise the store classes; they are
rewritten against the procedures that replace them rather than merely re-imported.

**Two store classes are misnamed.** `PGliteNameManagerStore` and
`PGliteRichContentStore` take `Kysely<Database>` and are dialect-agnostic; the
schemas are pure Kysely. Naming a dialect outside `runtime/server/persistence`
makes the eventual Postgres swap look larger than it is.

## Phases

The backend is a **reference implementation**, not a source to move. It keeps
working until Phase 6, so there is never a half-migrated tree that neither
application can build.

Every phase happens inside `apps/frontend/`. Promotion to the root is Phase 6,
last, when there is nothing left to break.

### Phase 1 — Server application

**Plan:** [`2026-08-14-phase-1-server-application.md`](../plans/2026-08-14-phase-1-server-application.md)

| | |
| --- | --- |
| Config | `adapter-static` → `adapter-node`; the `$runtime` alias; enable `experimental.remoteFunctions`; delete `export const ssr = false` |
| Seam | `hooks.server.ts`, `app.d.ts`, `$runtime/server/scope.server.ts` (stub) |
| Route | `src/routes/health/+server.ts` — process identity, matching today's `/health` |
| Tooling | vitest |
| Proof | A temporary `.remote.ts` and route asserting the wire works, deleted in Phase 5 |

Per-capability aliases are *not* added here — there are no capabilities in the
new tree yet, and an alias map full of forward declarations pointing at nothing
is what rule 10 exists to catch. Each capability's alias arrives with it.

**Verify:** the app builds to `build/index.js` and serves; `/app` renders
server-side; `/health` answers `200 application/json`; a remote function
resolves during render and reads `locals.scope`.

### Phase 2 — The capability standard

| | |
| --- | --- |
| Scripts | Move the four surviving scripts in; delete `new-endpoint` |
| Lint | Rewrite for this design — the whole rules table above |
| Docs | Move `docs/capability-directory/`, rewrite, delete the three endpoint templates, add the procedure-tree template |
| Tooling | The `lint` script |

Scoped to `capabilities/**`. `runtime/**` is left to convention, and three files
Phase 1 creates sit outside any capability — a test beside its module, a
`.remote.ts` outside `api/`, and a `.server.ts` door — so the capability rules
must not reach them.

**Verify:** `pnpm lint` runs and reports the four existing `$lib/capabilities`
modules as non-compliant. **Red is the expected outcome**, and its output is the
written work list for Phase 4.

### Phase 3 — Server runtime objects

| | |
| --- | --- |
| Build | `runtime/server/configuration`, `runtime/server/observability`, `runtime/server/persistence` — backend as reference |
| Registry | Per-project database opening, keyed by project, with the initializer list |
| Check | The introspection drift check |
| Fix | The three `import.meta.resolve` derivations |
| Wire | `hooks.server.ts`, SIGTERM shutdown |
| Tests | `observability`'s one test ported to vitest |

**Verify:** the server boots, opens a project database, logs, and shuts down
cleanly.

### Phase 4 — Client runtime objects

| | |
| --- | --- |
| Move | The four browser modules → `$lib/runtime/client/*`, reshaped onto the object template |
| **Rename** | `session` → `workbench`, `workspace` → `preferences`. Cheap now: nothing consumes either yet |
| **De-singleton** | Mandatory as of Phase 1, which turned SSR on — constructors called in the root layout, passed by context |
| **Persist** | A fifth object, `runtime/client/storage/`, owns browser storage. `workbench` and `preferences` read and write through it. No capability, no table, no `user_id` anywhere. Root `+layout.server.ts` supplies the initial values so the first paint is correct |
| **Reshape** | Geometry mechanics move from `context` into the panel components: the thresholds and the clamp-or-collapse decision. `context` keeps only the activities projection |
| Consumers | `$lib/shell/*` reads from context |

**Verify:** lint and typecheck green; tab and panel state survives a reload, with
no visible snap in panel width on hydration.

### Phase 5 — Capabilities as reference implementations

| | |
| --- | --- |
| `name-manager` | `types/`, `persistence/`, `api/{define,get,list,require}/` with procedure trees and remote wrappers. Project predicates dropped; `project_id` column removed. 6 tests to vitest, one of them rewritten |
| `rich-content` | Same, eleven functions, 11 tests, one of them rewritten |
| Naming | `PGlite*Store` names retired with the classes |
| Proof | A route and component reading a capability through its remote API — and Phase 1's smoke files deleted, since this replaces them |

**Verify:** lint, typecheck, test green; capability data renders in a browser.

### Phase 6 — Consolidate and delete

**What was done, which is not quite what this said.** Delete `apps/backend`.
Move `apps/frontend` to **`app/`** — not to the root — and remove `apps/`.
Update `infra/devshell`, README, `.gitignore`.

Moving the package whole rather than promoting its contents is what made this a
rename plus prose edits. `configuration/` and the project data directory travel
inside it, and nothing that resolves a path had to change: every lint and
generation script counts `dirname()` levels up from its own position *inside* the
package, and the configuration and persistence constructors resolve from
`process.cwd()`, which is still the package directory.

Eight configuration files carried over from the backend and read by nothing were
deleted rather than left looking live. One of them named size limits for Rich
Content that the capability does not enforce; that gap is now recorded in its
`overview.md`.

**Verified:** `pnpm lint`, `pnpm typecheck`, `pnpm test` (311), and
`pnpm test:scripts` (182) all green from `app/`; `pnpm build` produces
`build/index.js`; the running server answers `/health` `200`, redirects `/app` to
`/app/dev-project`, opens a project database logging `initializers: 3`, and
serves all eighteen generated remote endpoints.

## Post-integration

| | Note |
| --- | --- |
| Postgres | The registry is the only code that changes; per-project becomes a schema or a database |
| Kysely `Migrator` | Real up/down migrations. The drift check buys time, not correctness |
| Authentication | Users, projects, membership, route tokens, the control database, the real `scopeFor` |
| Cross-device user state | Tabs and preferences follow a user between browsers. Needs a user-scoped store, and the decision it forces — a database per user, or user tables in the control database. Deferred because the cookie covers the actual requirement today, and `runtime/client/storage` is the one place that changes |
| Live update fan-out | `LISTEN/NOTIFY` or a broker so one node's write reaches another's clients. CAS already prevents lost updates; this is liveness |
| Project registry eviction | Before many projects are open at once |
| `runtime/**` template | A fuller structure and lint rules for runtime objects |
| View organization | Deliberately deferred |
| Testing pass | Client object tests, e2e |
| Graceful shutdown | `adapter-node` builds `build/index.js`; a SIGTERM handler closes open project databases. Dev needs nothing — Vite tears itself down on Ctrl-C |
| `workspace` | Now unclaimed. Available for the whole screen, or the centre content area |

## Verification

- `pnpm lint` passes, including every changed and new rule.
- `pnpm typecheck` passes over one tree.
- `pnpm test` passes with all sixteen tests found and green under vitest.
- `pnpm build` produces a Node server; one `pnpm dev` serves everything.
- A route reads a capability through a `.remote.ts` and renders its data.
- Two project directories exist and their data does not mix.
- Starting against a table whose columns differ from `tables.ts` fails at startup
  with a message naming the drift.
- No `.svelte` or route file transitively imports a `*.server.*` — proved by the
  build succeeding, since kit fails it otherwise.
- No `endpoints/` directory, `job.ts`, `wire/`, or `EndpointJob` remains under
  `src/`, `scripts/`, or `docs/`.
- Every document required by the document rules is written, not left as an
  unsubstituted template.

## Open items

- **Whether the panel components persist a collapsed flag or derive it** from a
  stored width. Either works now that the mechanic lives in the component; it
  only decides whether `preferences` stores one value per panel or two.
- **One cookie or several.** One JSON cookie for all browser-persisted state is
  fewer moving parts; one per object keeps them independent and avoids a write
  from one clobbering the other. Internal to `runtime/client/storage`, so it can
  change without touching a consumer.

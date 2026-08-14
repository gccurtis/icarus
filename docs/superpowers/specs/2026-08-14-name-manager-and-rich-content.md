# Name Manager and Rich Content

**Status:** Design, awaiting review.
**Implements:** Phase 5 of
[the capability integration design](2026-08-13-capability-integration-design.md),
narrowed to the two capabilities that have working code.

---

## 1. What this does

Moves the backend's only two implemented capabilities into
`apps/frontend/src/lib/capabilities/`, reshaped onto the procedural standard.

They join `data/settings`, which was built first as the anchor for
[the scope and remote-boundary design](2026-08-14-capability-scope-and-the-remote-boundary.md)
and is the working reference for everything below. Before it, the four modules in
`lib/capabilities/` were browser state with no database and no server code —
they are now `runtime/client/*`, which is why both persistence seams were empty
until settings filled them:

```ts
// runtime/server/persistence/types.ts
export interface Database { settings: SettingsTable }   // ← tables.ts declares onto this

// runtime/server/persistence/index.server.ts
const INITIALIZERS = [initializeSettings];              // ← initialize.ts joins this list
```

A project database opens today logging `initializers: 1`. When this is done it
logs `initializers: 3`.

`document` is **not** in scope: 2,602 lines of design with no implementation, so
it is construction rather than translation, and it depends on Rich Content.

### What is being moved

| Capability | Destination | LOC | Tests | Public functions | Tables |
| --- | --- | --- | --- | --- | --- |
| `data/name-manager` | `capabilities/data/name-manager` | 1,654 | 6 | 4 | 1 |
| `resource-support/rich-content` | `capabilities/resource-support/rich-content` | 2,873 | 11 | 11 | 1 |

### What is not being moved

| | Why |
| --- | --- |
| `platform/web-server` | SvelteKit is the server |
| `built-in/endpoints` | `/health` is a route; `echo` was a dev probe |
| `platform/id-factory` | 12 lines around `randomUUID()` — owns no rows, has no lifetime. Its only consumer is Rich Content, whose prefixing wrapper becomes `api/shared/ids.ts` |
| `platform/{configuration,observability,persistence}` | already `runtime/server/*` |

### What this depends on, all of it already green

`runtime/server` (configuration, observability, per-project registry, `Scope`),
`runtime/client`, the written standard in `docs/capability-directory/`,
`pnpm lint:capabilities`, the two generators, and remote functions — which are
now enabled and were proven end to end against the built server: a
browser-reachable endpoint resolved scope through `hooks.server.ts`, opened the
project database, and returned `PostgreSQL 18.3 (PGlite 0.5.4)`.

---

## 2. What stays exactly the same

Most of both capabilities is a file move. Listing it first so the changes in §3
read as the short list they are.

| Backend | Frontend | |
| --- | --- | --- |
| `types/*.ts` | `types/*.ts` | verbatim; only `#alias/x.js` → `$alias/x` |
| `errors.ts` | `errors.ts` | verbatim — codes are the public contract |
| `persistence/stored-types.ts` | `persistence/stored-types.ts` | verbatim |
| `runtime-api/shared/*` | `api/shared/*` | verbatim |
| `runtime-api/<fn>/<supporting>.ts` | `api/<fn>/<supporting>.ts` | verbatim |
| `persistence/schema.ts` | `persistence/tables.ts` | renamed; content unchanged apart from §3.1 |

All the algorithms move untouched: name canonicalization, type and value
admission, the display projection, split, combine, mark slicing, range
resolution.

---

## 3. What changes

Six changes. Each is decided; §4 holds what is not.

### 3.1 `project_id` disappears

A project is its own database, so the column is dead weight and the predicate it
forced on every query is gone.

`name_manager_variables` drops `project_id`. Its primary key becomes `name_key`
alone, and `name_manager_variables_project_order` becomes an index on
`definition_order`.

Rich Content had **no** project column — it was silently single-project, a latent
defect the per-project database fixes for free.

### 3.2 The runtime object is deleted; instrumentation becomes a shared procedure

`runtime-objects/<x>/constructor.ts` and `definition.ts` are both deleted. The
class held no state — it bound a store and a logger, wrapped each call in
`record()`, and delegated.

`record()` moves to `api/shared/record.ts` and each entry calls it. This is
strictly stronger than the wrapper: a caller could reach past the object and skip
its instrumentation, and there is now no object to reach past.

### 3.3 The store class dissolves into `api/`

SQL lives in the procedure that runs it, promoted to `api/shared/` when a second
procedure needs it — the ordinary promotion rule, applied to queries.

**Both capabilities had a store method called `find`.** They are renamed to what
they do, because two different things sharing a name is exactly what made this
section unreadable in the previous draft.

| Capability | Backend method | Callers | Lands in |
| --- | --- | --- | --- |
| Name Manager | `store.find(nameKey)` | `define`, `get`, `require` | `api/shared/find-variable.ts` |
| Name Manager | `store.create` | `define` | `api/define/define.ts` |
| Name Manager | `store.list` | `list` | `api/list/list.ts` |
| Rich Content | `store.find(id)` | all 11 | `api/shared/revisions.ts` as `loadContent` |
| Rich Content | `store.compareAndSwap` | 8 mutations | `api/shared/revisions.ts` |
| Rich Content | `store.replaceOneWithTwo` | `split` | `api/shared/revisions.ts` |
| Rich Content | `store.replaceManyWithOne` | `combineAsList` | `api/shared/revisions.ts` |

Name Manager's `findVariable` earns promotion because it owns the name-key
canonicalization its three callers must agree on — a shared invariant, not merely
shared code.

Rich Content's four all go to `revisions.ts` because they are one concern:
reading a content object at a revision and replacing it only if that revision
still holds. `replaceOneWithTwo` and `replaceManyWithOne` are multi-row
transactions that signal conflict by returning `false` from a rolled-back
transaction. **Dissolving the store must not split either transaction**; what
changes is only which directory it lives in.

### 3.4 `Scope` becomes the first parameter

The backend bound `projectId` at construction. Every procedure now takes
`Scope` first and its own input as the rest. Scope is never a field on an input
type, so the browser's payload has no slot for `projectId` or `userId`.

### 3.5 A procedure reaches the database through one accessor

**Settled and built** in
[Capability Scope and the Remote Boundary](2026-08-14-capability-scope-and-the-remote-boundary.md),
along with how scope arrives from a browser call at all. `data/settings` is the
working reference; this document only consumes the result.

The result: the logger is process-wide and `record()` resolves it itself, so an
entry never mentions it. The database is per-project and cannot be imported, so
it is one call taking the project — `projectDatabase(scope.projectId)`, exported
from `runtime/server/index.server.ts`.

Two things that document added, which apply here unchanged: every remote wrapper
resolves a **project token** into a `Scope` and wraps its body in
`api/shared/stated.ts`, without which a `NameManagerError` or `RichContentError`
reaches the browser as `500 Internal Error`.

```ts
export const define = async (scope: Scope, input: NamedVariableInput): Promise<NamedVariable> =>
  record("define", { name: input.name, kind: input.type?.kind }, async () => {
    const database = await projectDatabase(scope.projectId);
    …
  });
```

### 3.6 Both doors, and remote wrappers

```ts
// index.server.ts — load functions, form actions, other capabilities
export { define, get, require, list } from "$name-manager/api/…";
export type { NamedVariable, NamedVariableInput } from "$name-manager/types/variables";
export { NameManagerError } from "$name-manager/errors";

// index.ts — views only. Remote re-exports and nothing else.
export { define, get, list } from "$name-manager/api/…/*.remote";
```

They cannot be merged: `index.ts` would import procedures and therefore Kysely,
and kit's server-only guard runs on the module graph at resolve time, so
tree-shaking does not save a view that imports the capability.

Each `<function>.remote.ts` is three lines, declared `'unchecked'` because the
capability validates its own input. Every function with one is directly reachable
by an untrusted browser and owns validating what it receives — recorded in
`overview.md`, with `api/*/*.remote.ts` as the audit list.

---

## 4. Open questions

Five things I have a recommendation on but have not decided.

### Q1 — Does `require` get a remote wrapper?

`require` differs from `get` only in treating absence as a failure. That reads
like a decision a server caller makes when it cannot continue; a browser asking
for something that may not exist wants `get` and a branch.

**Recommend: no `.remote.ts` for `require`.** Easy to add later; harder to
withdraw once a view depends on it.

### Q2 — How do tests assert on generated identity?

Rich Content's tests assert `content-1`, `atom-2`, `mark-3`. That worked because
`deterministicIds()` was injected into the runtime object. With `api/shared/ids.ts`
imported, the real generator is UUID-backed.

Most of those assertions were testing the fixture rather than the capability, and
become assertions on shape and relationship — an id is a non-empty string, two
allocations differ, the id a mutation returns is the id `display` reports. A few
genuinely need stable identity to express the behavior at all: `split` producing
two contents from one, `combineAsList` folding many into one.

**Recommend: relax where the identity is incidental, `vi.mock("$rich-content/api/shared/ids")`
for the handful where it is the point.**

### Q3 — Does the `$runtime` → `$model` rename happen first?

`docs/model-directory/model-directory.md` renames `$runtime` to `$model`. Both
capabilities import server doors, so every one of those imports gets touched
twice if the rename comes after.

**Recommend: rename first.** `runtime/` has no consumers outside itself today,
which is the cheapest this will ever be.

### Q4 — Do the backend's group directories survive?

`data/` and `resource-support/` each hold one capability. Preserving them means
`document` later lands in `resource-general/` without a reshuffle; flattening
means two fewer directories now.

**Recommend: keep them.**

### Q5 — What replaces the store's project-isolation test?

`unit/persistence/store.test.ts` asserted that two projects' variables do not
mix. That is now structurally true — two databases — rather than a property of a
predicate the capability remembered to write.

**Recommend: one registry-level test in `runtime/server/persistence`, and no
per-capability restatement.** Alternative is asserting it once per capability
forever, which tests the registry repeatedly under other names.

---

## 5. Testing

Removing the runtime object removes three injection points the backend's tests
used: the fake store, the counting ID factory, and the silent logger. Q2 covers
the ids. The other two are here.

### Why removing the fake store improves the tests

`MemoryNameManagerStore` existed because every backend test entered through the
runtime object, so faking the layer beneath it was the only way to be fast.
Procedural code lets a test call the procedure it is testing.

| Tier | Touches | Covers |
| --- | --- | --- |
| Pure procedure | nothing | `canonicalName`, `canonicalType`, `canonicalValue`, `canonicalDate`, `renderDisplay`, `splitRawContent`, `combineRawContent`, mark slicing, range resolution |
| Entry | in-memory PGlite | conflict detection, ordering, CAS, the two transactions |
| Instrumentation | a recording logger | `record()` emitting `rejected` for a capability error, `failed` for anything else |

Tier one is the bulk of both capabilities and was previously reachable only
through a fake. Name Manager's four `canonical-*` files are 368 of its 1,654
lines and are pure functions over their input.

### Database cost, measured

In-memory PGlite is **~750ms per instance** — five runs on this machine gave
1044, 784, 729, 729, 719 ms. That is affordable per test *file* and not per test.

```ts
// test/fixture.ts
beforeAll(…)   // PGlite.create(), Kysely, this capability's initialize()
beforeEach(…)  // truncate this capability's tables
afterAll(…)    // database.destroy()
```

Seventeen files at one database each is ~13s of setup, spread across vitest's
parallel workers. One per test would put the suite in minutes.

### Substituting the database

Tier-two tests `vi.mock("$runtime/server/index.server")` once, in the shared
fixture, so `projectDatabase` returns the test database. One mock, one module, and
every procedure runs its real code path with its real signature.

### Test file mapping

| Backend | Frontend |
| --- | --- |
| `nm/unit/runtime-api/{define,get,list,require}/*.test.ts` | `nm/unit/api/{…}/*.test.ts` — `define`'s admission half becomes tier one |
| `nm/unit/runtime-objects/name-manager/instrumentation.test.ts` | `nm/unit/api/shared/record.test.ts` |
| `nm/unit/persistence/store.test.ts` | dissolves — see Q5 |
| `rc/unit/runtime-api/<10 functions>/*.test.ts` | `rc/unit/api/<same>/*.test.ts` |
| `rc/unit/persistence/store.test.ts` | `rc/unit/api/shared/revisions.test.ts` |

---

## 6. Name Manager

`src/lib/capabilities/data/name-manager/`, alias `$name-manager`.

```text
data/name-manager/
├── overview.md
├── index.server.ts               define, get, require, list + types + error
├── index.ts                      remote re-exports
├── errors.ts                     6 codes, verbatim
├── types/
│   ├── types.md
│   └── dates.ts  schema.ts  values.ts  variables.ts
├── api/
│   ├── api.md
│   ├── shared/
│   │   ├── shared.md
│   │   ├── record.ts             instrumentation
│   │   ├── canonical-name.ts     canonicalName + nameKey
│   │   ├── copy-variable.ts      structuredClone at the boundary
│   │   └── find-variable.ts      promoted — define, get, require
│   ├── define/
│   │   ├── define.md  define.ts  define.remote.ts
│   │   ├── canonical-variable.ts  canonical-type.ts
│   │   ├── canonical-value.ts     canonical-date.ts
│   │   └── value-guards.ts
│   ├── get/     get.md  get.ts  get.remote.ts
│   ├── require/ require.md  require.ts            (Q1)
│   └── list/    list.md  list.ts  list.remote.ts
├── persistence/
│   └── persistence.md  tables.ts  initialize.ts  stored-types.ts
└── test/unit/…
```

### Table

```sql
name_manager_variables
  name_key          text primary key      -- lowercased lookup form
  name              text not null         -- authored casing
  declared_type     jsonb not null
  value             jsonb not null
  definition_order  integer generated always as identity not null
```

Index on `definition_order` for `list`'s ordering.

### `define`'s procedure tree

Lint resolves every `.ts` path in this block, so a rename that misses the tree
fails rather than rots.

```text
define(scope, input)
├── record("define", …)                  shared/record.ts
├── canonicalName(input.name)            shared/canonical-name.ts
├── projectDatabase(scope.projectId)         $runtime/server
├── findVariable(database, key)          shared/find-variable.ts
│   └── reject name-conflict before admitting type or value
├── canonicalVariable(input)             canonical-variable.ts
│   ├── canonicalType(input.type)        canonical-type.ts
│   └── canonicalValue(type, value)      canonical-value.ts
│       ├── valueGuards()                value-guards.ts
│       └── canonicalDate(value)         canonical-date.ts
├── insert … on conflict do nothing
└── copyVariable(variable)               shared/copy-variable.ts
```

The conflict is decided **before** the type and value are admitted, so a
redefinition attempt reports `name-conflict` rather than whichever schema fault
its payload happens to carry. That ordering is behavior, and its test moves with
it.

---

## 7. Rich Content

`src/lib/capabilities/resource-support/rich-content/`, alias `$rich-content`.

Eleven functions: `create`, `display`, `replaceText`, `applyStyle`,
`removeStyle`, `setLink`, `removeLink`, `setList`, `removeList`, `split`,
`combineAsList`.

```text
resource-support/rich-content/
├── overview.md  index.server.ts  index.ts  errors.ts
├── types/
│   ├── types.md
│   ├── display-content.ts        the public projection
│   ├── raw-content.ts            private — never re-exported
│   └── formatting.ts  ids.ts  runtime-inputs.ts  runtime-results.ts
├── api/
│   ├── api.md
│   ├── shared/
│   │   ├── shared.md
│   │   ├── record.ts
│   │   ├── ids.ts                contentId/atomId/markId/listId
│   │   ├── revisions.ts          loadContent, CAS, replaceOneWithTwo, replaceManyWithOne
│   │   ├── render-display.ts     raw → display projection
│   │   └── display-range.ts  ranges.ts  raw-lines.ts  mark-pieces.ts
│   │       style.ts  link.ts  list.ts
│   ├── create/          create.md  create.ts  create.remote.ts  create-raw-content.ts
│   ├── display/         display.md  display.ts  display.remote.ts
│   ├── replace-text/    …  replace-atom-text.ts
│   ├── apply-style/  remove-style/  set-link/  remove-link/  set-list/  remove-list/
│   ├── split/           …  split-raw-content.ts
│   └── combine-as-list/ …  combine-raw-content.ts
├── persistence/  persistence.md  tables.ts  initialize.ts  stored-types.ts
└── test/unit/…
```

### Table

```sql
rich_content
  id           text primary key
  revision     integer not null
  raw_content  jsonb not null
  updated_at   timestamptz not null
```

Unchanged from the backend; per-project now by virtue of which database holds it.

### Two properties that must survive the move

**Compare-and-swap is the correctness guarantee.** `compareAndSwap` asserts the
revision advances by exactly one and updates `where revision = expected`,
reporting whether one row changed. `split` and `combineAsList` are transactional:
delete each original at its expected revision, insert the replacement, and roll
back on any mismatch. See §3.3 — the transactions move whole.

**Raw Content stays private.** `index.server.ts` re-exports `DisplayContent` and
never `RawAtom`, `RawMark`, or `RawContent`; a consumer holding a raw type could
construct positions the runtime never validated. Worth restating in
`overview.md`, because a two-door split makes it easy to widen a door by
accident.

---

## 8. Order of work

Name Manager entirely, then Rich Content entirely. Not in parallel: Name Manager
is small enough that a wrong translation rule is cheap to find, and what it
teaches applies to eleven functions instead of four.

| # | Step | Done when |
| --- | --- | --- |
| 0 | Q3, if the answer is yes | `$model` resolves; tree green |
| 1 | `projectDatabase` on the server door | its test passes |
| 2 | NM types, errors, persistence | a project database logs `initializers: 2` |
| 3 | NM `api/` — `shared/`, then the four functions | lint clean, procedure trees resolve |
| 4 | NM tests, all three tiers | suite green |
| 5 | NM doors, remotes, alias | typecheck + build |
| 6 | RC, same sequence | `initializers: 3` |
| 7 | One route rendering `list()` through `index.ts` | capability data on a screen |

Every step ends lint-, typecheck-, and test-green. Nothing is half-migrated at a
step boundary.

---

## 9. Verification

```sh
pnpm lint:capabilities   # 3 capabilities on the template, 0 problems
pnpm typecheck           # 0 errors
pnpm test                # 59 existing + both suites
pnpm test:scripts        # 43
pnpm build && node build/index.js
```

- A project database opens logging `initializers: 3`.
- Two project directories hold different variables and neither sees the other's.
- Starting against a table whose columns differ from `tables.ts` fails at startup
  naming the drift.
- `define` twice with the same name in different casing reports `name-conflict`.
- A stale `expectedVersion` reports `stale-version` and changes no row.
- A route renders variables fetched through `index.ts`, with no `.server.` module
  in the client graph — proved by the build, which kit fails otherwise.
- `grep -rn "project_id" src/lib/capabilities/` returns nothing.

---

## 10. Out of scope

| | |
| --- | --- |
| `document` | design only; construction work, downstream of Rich Content |
| Svelte `experimental.async` | under SSR `{#await}` renders the pending branch without waiting, so a server-rendered view needs `+page.server.ts` or that flag. `/app` is `ssr = false`, so it does not bite until step 7 |
| Kysely `Migrator` | the drift check buys time, not correctness |
| Real Postgres | the registry is the only code that changes |
| Authentication | `resolveScope` already has the seam |

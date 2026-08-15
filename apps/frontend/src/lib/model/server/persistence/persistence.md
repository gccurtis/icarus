# Persistence

## Description

Persistence holds one open database **per project**, opening each on first use,
so that a capability procedure can ask for the database its scope names and
receive one that is already there.

A project is its own PGlite directory. That is what makes project scoping
structural: no query carries a `project_id` predicate, no table carries the
column, and a capability that forgets to scope *cannot* leak across projects
because there is no cross-project reach to forget.

```text
data/projects/<projectId>/     one embedded PostgreSQL database
```

Under Postgres later this becomes a schema or a database per project. Only
`open-project/` changes.

## Ownership Boundary

Persistence owns:

- which projects are open, and the one database each of them has
- the WASM instance and file handles behind each database, until shutdown
- the order capability schemas are created in

Consumers own:

- the rows in their own tables, and every query against them

## Lifetime

- **Instance:** one per server process
- **Constructed by:** `buildServerModel`, after configuration and observability
- **Released by:** process shutdown, first — before logging, so its own close
  records still reach the destination

Construction opens nothing. A process that never serves a project never creates
one.

## Public Methods

| Method | Shape | Effect | Description | Document |
| ------ | ----- | ------ | ----------- | -------- |
| `forProject` | directory | mutator | Answers with a project's database, opening it on first use | [for-project.md](methods/for-project/for-project.md) |
| `close` | file | mutator | Closes every open database, settling rather than racing | — |

## Exposed State

None. What is open is this object's own business: a consumer that could read the
map could hold a database past the shutdown that closed it.

## Construction

```ts
export const createPersistence = (
  configuration: Configuration,
  logger: Logger
): Persistence => ...;
```

Every call returns a fresh registry over its own directory root.

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| `configuration` | BORROWED | Read once for the projects directory |
| `logger` | BORROWED | Records every open and close; closed by observability, never here |
| each project's PGlite instance | OWNED | Acquired on first use, released by `close` |

## Initializers

`INITIALIZERS` in [`constructor.ts`](constructor.ts) is the composition root for
storage: the one place that knows the full set of tables a project database
holds. Each capability with a `persistence/` exports one, and a capability absent
from that list has no tables however many it declares.

Each initializer creates its tables if absent **and then verifies them**.
`createTable().ifNotExists()` is not a migration strategy — it creates when
absent and does nothing when present, so the first added column silently
succeeds against an outdated database and fails later at query time, far from the
cause. Real migrations replace this; the check buys time, not correctness.

## Terminal Behaviour

- **Terminal operation:** `close`
- **Releases, in this order:** every open project concurrently, then nothing
  else. Each project ends its dialect connection and then releases the instance
  that holds the directory.
- **After release:** the map is empty, so a later `forProject` opens a new
  database. Nothing revives the ones that were closed, and the composition root
  is what makes sure no later call arrives — the process is shutting down.

Closing settles rather than races. One project failing must not leave the others
holding their directories, and every failure travels in one `AggregateError`
rather than replacing the one before it.

## Concurrency and SSR

- `forProject` caches the in-flight promise, so two callers arriving together
  against an unopened project share one open. PGlite is single user/connection,
  so the alternative is not slow, it is corrupt.
- A failed open is evicted, so the next caller retries.
- `close` empties the map before awaiting, so a caller arriving mid-shutdown
  cannot be handed a database that is already closing.

## Invariants

- One open database per project id, for as long as the process holds it.
- A project id that could name anything but a directory is rejected, never
  rewritten: a silently corrected id would open a *different* project's database.
- Every instance acquired is either handed back inside a `ProjectDatabase` or
  released before the failure escapes.
- An instance is closed at most once. Closing a closed one throws, which would
  turn every clean shutdown into a non-zero exit.

## File Tree

```text
persistence/
├── persistence.md
├── index.server.ts
├── types.ts
├── definition.ts
├── constructor.ts
├── methods/
│   ├── methods.md
│   ├── close.ts
│   └── for-project/
└── test/
```

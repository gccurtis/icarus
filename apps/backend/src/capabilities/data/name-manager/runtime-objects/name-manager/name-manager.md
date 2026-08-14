# Runtime Object: `NameManager`

`NameManager` is the runtime authority for named variable declarations within
one project. Other capabilities reach declarations through its four async
methods rather than through storage of their own, which is what keeps one name
from meaning two things.

It deliberately does not own what a declaration *means*. It never evaluates
Formula or function source, never follows a reference, and never projects a
declaration to a resolved value — those belong to the later Formula integration.

## Interface

Declared in [`definition.ts`](definition.ts). Each method is a delegation to its
[`runtime-api`](../../runtime-api/runtime-api.md) entry, passing the store it
holds; this file contains no validation, no lookup rule, and no copying.

```ts
export interface NameManager {
  define(variable: NamedVariableInput): Promise<NamedVariable>;
  get(name: string): Promise<NamedVariable | undefined>;
  require(name: string): Promise<NamedVariable>;
  list(): Promise<readonly NamedVariable[]>;
}
```

`PersistedNameManager` is the internal implementation. Consumers hold the
exported `NameManager` interface; the concrete class is visible only inside the
capability for construction and tests.

## Fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `store` | `NameManagerStore` | Project-bound port over canonical declarations in the shared database |
| `logger` | `Logger` | Records each call and its outcome |

The store is private and never escapes. Each method hands it to one
`runtime-api` entry; those procedures know only the narrow persistence
operations they need, not Kysely or PGlite.

## Constructor

`createNameManager(database, projectId, logger)` in
[`constructor.ts`](constructor.ts). The database is the shared Persistence
runtime's Kysely instance; the opaque, non-empty project ID selects the catalog
namespace; the logger records operations.

```text
1. Bind a `PGliteNameManagerStore` to the database and project ID.
2. Await idempotent table and index initialization.
3. Construct `PersistedNameManager` with that store and logger.
4. Return it as a `NameManager` without taking ownership of the database.
```

## Instrumentation

Each method records what it was asked for before the work and how it ended after:
a `debug` pair around a successful call, a `warn` when a `NameManagerError` is
raised, and an `error` for anything else. Events are named
`name-manager.<method>.started`, `.completed`, `.rejected`, and `.failed`.

**Only names, shapes, and counts are recorded — never an authored value.** The
store holds whatever an author put in it, and a log outlives, and travels
further than, the data it describes.

## Invariants

- The project-bound store is only ever reached through this object; no consumer
  holds a reference to it.
- Every persisted declaration has been admitted. A caller cannot place an
  unvalidated declaration there, and a failed admission leaves the catalog
  exactly as it was.
- No stored declaration shares an object reference with a caller, in either
  direction, so a retained input or a returned value cannot be mutated into the
  catalog.
- Its state is database- and project-scoped: constructing a second object over
  the same pair observes the same catalog, while a different project ID observes
  a separate namespace.

# Runtime Object: `NameManager`

`NameManager` is the sole authority for named variable declarations within one
backend runtime. Other capabilities reach declarations through its four methods
rather than through any storage of their own, which is what keeps one name from
meaning two things.

It deliberately does not own what a declaration *means*. It never evaluates
Formula or function source, never follows a reference, and never projects a
declaration to a resolved value — those belong to the later Formula integration.

## Interface

Declared in [`definition.ts`](definition.ts). Each method is a delegation to its
[`runtime-api`](../../runtime-api/runtime-api.md) entry, passing the catalog it
holds; this file contains no validation, no lookup rule, and no copying.

```ts
export interface NameManager {
  define(variable: NamedVariableInput): NamedVariable;
  get(name: string): NamedVariable | undefined;
  require(name: string): NamedVariable;
  list(): readonly NamedVariable[];
}
```

`InMemoryNameManager` is the only implementation. It is exported so a consumer
can name the concrete class, but a consumer should hold the `NameManager` type:
the in-memory qualifier is a fact about today's storage, and replacing it with a
persisted implementation must not change any caller.

## Fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `variables` | `VariableCatalog` | Every current declaration, keyed by the lower-cased form of its authored name, in definition order |
| `logger` | `Logger` | Records each call and its outcome |

The catalog is private and never escapes. Each method hands it to a `runtime-api`
entry; only `define` receives it as a mutable `VariableCatalog`, the others as a
`ReadonlyVariableCatalog`.

## Constructor

`createNameManager(logger)` in [`constructor.ts`](constructor.ts). The logger is
its only dependency, and is required: a catalog constructed without one would be
silently uninstrumented, and the omission would surface only when someone went
looking for records that were never written.

```text
1. Construct one InMemoryNameManager with an empty catalog.
2. Return it as a NameManager.
```

An eventual storage adapter arrives as a second constructor parameter here, and
the variable algebra does not move.

## Instrumentation

Each method records what it was asked for before the work and how it ended after:
a `debug` pair around a successful call, a `warn` when a `NameManagerError` is
raised, and an `error` for anything else. Events are named
`name-manager.<method>.started`, `.completed`, `.rejected`, and `.failed`.

**Only names, shapes, and counts are recorded — never an authored value.** A
catalog holds whatever an author put in it, and a log outlives, and travels
further than, the data it describes.

## Invariants

- The catalog is only ever reached through this object; no other capability holds
  a reference to it.
- Every declaration in the catalog has been admitted. A caller cannot place an
  unvalidated declaration there, and a failed admission leaves the catalog
  exactly as it was.
- No stored declaration shares an object reference with a caller, in either
  direction, so a retained input or a returned value cannot be mutated into the
  catalog.
- Its state is the runtime's lifetime: constructing a second object gives an
  empty, unrelated catalog, and closing the runtime discards every declaration.

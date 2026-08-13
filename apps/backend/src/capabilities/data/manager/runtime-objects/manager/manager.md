# Runtime Object: `DataManager`

`DataManager` is the sole authority for named variable declarations within one
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
export interface DataManager {
  define(variable: NamedVariableInput): NamedVariable;
  get(name: string): NamedVariable | undefined;
  require(name: string): NamedVariable;
  list(): readonly NamedVariable[];
}
```

`InMemoryDataManager` is the only implementation. It is exported so a consumer
can name the concrete class, but a consumer should hold the `DataManager` type:
the in-memory qualifier is a fact about today's storage, and replacing it with a
persisted implementation must not change any caller.

## Fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `variables` | `VariableCatalog` | Every current declaration, keyed by the lower-cased form of its authored name, in definition order |

The field is private and never escapes. Each method hands it to a `runtime-api`
entry; only `define` receives it as a mutable `VariableCatalog`, the others as a
`ReadonlyVariableCatalog`.

## Constructor

`createDataManager()` in [`constructor.ts`](constructor.ts). It takes no
parameters, because the object depends on nothing that startup must supply.

```text
1. Construct one InMemoryDataManager with an empty catalog.
2. Return it as a DataManager.
```

An eventual storage adapter arrives as a constructor parameter here, and the
variable algebra does not move.

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

# Runtime Object: `IdFactory`

Lives at `runtime-objects/id-factory/id-factory.md`.

## Responsibility

`IdFactory` produces identifier values. One method, one value per call, no
state. It is the one place a backend runtime decides how a fresh identifier is
generated, so changing the scheme — to ULIDs, to a node-prefixed sequence, to
anything sortable — is a change to
[`runtime-api/create/create.ts`](../../runtime-api/create/create.ts) and to
nothing else.

It deliberately does not own what an identifier means. It has no notion of
content, atoms, documents, or rows; it applies no prefix and it returns no
branded type. Those belong to the capability allocating the identity, which
keeps its own factory with its own named methods and delegates only the value
here. The reasoning is in [`overview.md`](../../overview.md).

It also does not own uniqueness *within* a consumer's data. Nothing here checks
that a value is unused, because nothing here knows where values are stored. The
guarantee is that a collision is not a case worth handling, not that a lookup
was performed.

## Interface

Declared in [`definition.ts`](definition.ts). `create` delegates to its
[`runtime-api`](../../runtime-api/runtime-api.md) entry; this file holds no
algorithm.

```ts
export interface IdFactory {
  create(): string;
}
```

`UuidIdFactory` is the implementing class. It is not re-exported from
`index.ts`: a consumer depends on the interface, and a test that wants
predictable values supplies its own object literal rather than subclassing this
one.

## Fields

None. The object holds no counter, no seed, and no issued-value set, which is
what makes one instance safe to share across every capability in a runtime.

## Constructor

`createIdFactory()` in [`constructor.ts`](constructor.ts). It takes no
parameters.

### Construction Steps

```text
1. Return a UuidIdFactory.
```

There is no startup work to do. The constructor exists anyway, because
`index.ts` exporting a constructor rather than an instance is what lets a
runtime own its factory's lifetime and lets a second runtime in the same process
— a test harness, for instance — hold a different one.

## Invariants

- Two calls never return the same value, within a runtime or across runtimes.
- The returned value is opaque. It carries no kind, no prefix, and no ordering,
  and a consumer that parses one is relying on something this object does not
  promise.
- The object is stateless, so it is reentrant and needs no synchronization.
- `create` is total: it returns a value or the process has failed, and it never
  awaits.

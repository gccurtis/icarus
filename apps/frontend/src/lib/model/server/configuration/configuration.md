# Configuration

## Description

Configuration holds one immutable snapshot of `configuration/*.yaml`, read once
at startup, so that every other object and every capability reads the same
values for the life of the process without touching a disk.

## Ownership Boundary

Configuration owns:

- the merged snapshot of every YAML section, and the order they merged in
- the answer to a dot-separated key path

Consumers own:

- what each key means, whether it may be absent, and what shape it must have

The interface is one method on purpose. Typed getters, schemas, and defaults
would put every consumer's expectations in one place, and the only thing that
knows whether `logging.level` may be absent is the code that reads it.

## Lifetime

- **Instance:** one per server process
- **Constructed by:** `buildServerModel`, first and before anything that can fail
- **Released by:** nothing — this object holds no handle, only a frozen value

Reading happens once. The snapshot is never reloaded, which is what makes every
later read synchronous and free of a failure path.

## Public Methods

| Method | Shape | Effect | Description |
| ------ | ----- | ------ | ----------- |
| `get` | file | accessor | Resolves a dot path against the snapshot, or `undefined` |

A simple method has no document of its own. [`methods/methods.md`](methods/methods.md)
lists it.

## Exposed State

None. Everything readable is reached through `get`, so there is no field a
consumer could hold and no tree it could walk into.

`requiredString` travels with the interface rather than being a method: it reads
through `get` like any consumer, and it exists because "non-empty string" is the
shape nearly every key has and eight hand-written copies of that check drift.

## Construction

```ts
export const createConfiguration = (): Promise<Configuration> => ...;
```

Every call returns a fresh object over a freshly read tree.

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| the `configuration/` directory | BORROWED | Read once; the process owns the files |

The directory is resolved from the process working directory, deliberately not
from this module's own location. Under Vite these modules are bundled into a
chunk under `build/server/`, so `import.meta.url` would resolve to a directory
that exists and is wrong — producing an empty configuration rather than an error.
The backend derived it that way, and it was one of three path derivations this
migration had to repair.

Sections merge in lexicographic order; optional `local.yaml` merges last, which
is what makes it the place for a real API key without touching a tracked file.
Nested mappings merge; arrays and scalars replace, so a configured list is the
list rather than an append to a default.

## Terminal Behaviour

None. This object owns nothing releasable.

## Concurrency and SSR

- Construction is asynchronous and reads every file before returning. Nothing
  observes a partly merged tree, because the tree is unreachable until the
  snapshot exists.
- `get` is synchronous and reads a frozen value, so overlapping calls cannot
  interfere.

## Invariants

- The snapshot is frozen to its leaves. A consumer that mutated what it read
  would change what every later reader sees, which is a defect that surfaces far
  from its cause; freezing turns it into a throw at the write.
- Merged mappings have a null prototype, so a `__proto__` or `constructor` key in
  a YAML file cannot pollute objects configuration has nothing to do with.
- A missing key, an empty segment, and a path running through a non-mapping all
  answer `undefined`. Absence is never distinguished from malformation, because
  the caller is the only party that knows which of the two is an error.

## File Tree

```text
configuration/
├── configuration.md
├── index.server.ts
├── types.ts
├── definition.ts
├── constructor.ts
├── methods/
│   ├── methods.md
│   └── get.ts
└── test/
```

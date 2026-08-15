# Configuration Methods

`methods/` holds the execution behind the public surface. The definition is the
readable surface and delegates to these files, so reading `types.ts` tells you
what this object offers and reading a method tells you how it holds.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `get` | file | [`get.ts`](get.ts) | accessor | Resolves a dot path against the snapshot |

## Shape

`get` is one file because one file tells the truth about it: a path is split,
walked, and answered. It becomes a directory the day a key path means more than
a walk — an environment overlay, a lookup that can fail loudly — and not before.

Reading files, merging sections, and freezing the tree are not here. They happen
once, before an instance exists, and they belong to
[`../constructor.ts`](../constructor.ts) for the same reason: a method is
something a consumer can call, and nothing can call them.

## State Access

The method receives the merged root as a parameter from the definition. It never
imports it, because there is nothing at module scope to import — a method that
reached for a module-level value would be shared by every instance of this
object.

The root is frozen before it reaches the definition, so a method cannot assign
through it even by accident.

## Shared Methods

Nothing has been promoted. One public method cannot share anything with a second
one that does not exist.

## Common Shape

```text
1. reject a key path that cannot mean anything
2. walk own properties, one segment at a time
3. answer the value found, or undefined
```

## Concurrency

`get` is synchronous and reads a frozen value, so it is indivisible and there is
no state for a second caller to observe half-changed.

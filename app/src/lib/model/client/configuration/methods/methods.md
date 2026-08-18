# Configuration Methods

Lives at `methods/methods.md`.

`methods/` holds the execution behind the public surface. The definition is the
readable surface and delegates to these files, so reading `types.ts` tells you
what this object offers and reading a method tells you how it holds.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `get` | file | [`get.ts`](get.ts) | accessor | Resolves a dot-separated key path against the snapshot |

## Shape

One method, one file. It becomes a directory when it owns supporting flow, and
nothing suggests it will: a traversal that grew a second step would be a sign
that configuration had started interpreting values, which is the thing it exists
not to do.

## State Access

`get` receives the snapshot itself rather than the definition's state, because
the snapshot *is* the state and there is nothing else on the instance. Nothing
mutates it — the object exposes no writer, and the definition holds it in a
private readonly field.

## Shared Methods

Nothing has been promoted. There is one method.

## Common Shape

```text
1. Reject a key that cannot address anything — empty, or with an empty segment
2. Walk the segments, stopping at the first that is not an own key of a mapping
3. Return what is there, or undefined
```

## The duplication with the server

`get` is deliberately identical to
[`$model/server/configuration/methods/get.ts`](../../../server/configuration/methods/get.ts),
and so is `isConfigurationObject` in `types.ts`. The `environment` lint rule
forbids the client tree from importing the server tree, and no third place
exists for a model helper.

That is the right trade in both directions. Sharing them would mean either a
module both environments import — which is what the rule exists to prevent — or
a capability holding something that is not stored data. Resolving paths
*differently* on the two sides would be far worse than writing the traversal
twice: the same key would mean two things depending on who asked.

If the two ever need to diverge, that is a defect in one of them.

## Concurrency

Nothing here is asynchronous and nothing mutates. Every call is a pure read of a
value fixed at construction, so two calls cannot interleave into anything a
single call would not produce.

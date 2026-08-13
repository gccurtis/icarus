# Runtime Object: `Configuration`

Lives at `runtime-objects/configuration/configuration.md`.

## Responsibility

`Configuration` owns one immutable snapshot of the backend's committed settings
and answers dot-path lookups against it. Every capability that needs a setting
holds this object; none of them reads a configuration file.

It deliberately does not own the meaning of any key, the type of any value,
reloading, environment-variable overlays, or secret handling.

## Interface

Declared in [`definition.ts`](definition.ts). `get` delegates to its
[`runtime-api`](../../runtime-api/runtime-api.md) entry; this file holds no
traversal logic and no file access.

```ts
export interface Configuration {
  get(key: string): unknown;
}
```

`SnapshotConfiguration` is the implementing class. It is constructed with an
already-frozen tree, which is why it has no way to invalidate or replace one.

## Fields

| Field | Type | Description |
| ----- | ---- | ----------- |
| `root` | `ConfigurationObject` | The frozen merge of every YAML section, private to the class |

## Constructor

`createConfiguration()` in [`constructor.ts`](constructor.ts). It takes no
parameters: the configuration directory is resolved from the `#configuration`
package alias, so the location is a packaging decision rather than a caller's.

### Construction Steps

```text
1. Resolve the configuration directory from the #configuration alias.
2. List every *.yaml entry and sort it, then move local.yaml to the end when present.
3. Parse and deep-merge each file in that order, overlay winning.
   || a file is missing a YAML mapping at its root, or fails to parse
      3.a.1. Throw `Invalid configuration file '<name>': <reason>`, with the parse error as cause.
4. Deep-freeze the merged tree.
5. Return a frozen SnapshotConfiguration over it.
```

## Invariants

- The snapshot is loaded once, in the constructor. No method reaches the
  filesystem.
- Neither the returned object nor any mapping reachable from it can be mutated.
- Every consumer that asks for the same key receives the same value for the
  lifetime of the runtime.

# API: `get`

Looks one declaration up by name.

## Classification

- **Effect:** reader
- **Transaction:** none
- **Entry:** [`get.ts`](get.ts)
- **Browser-reachable:** yes, via [`get.remote.ts`](get.remote.ts)

## Signature

```ts
export const get = async (
  scope: Scope,
  name: string
): Promise<NamedVariable | undefined>;
```

The name is a positional parameter rather than an input object, because there is
one thing to pass and an object would only give it a second name.

## Absence is an answer; an unusable name is not

`undefined` means the catalog holds nothing under that name, and a caller
branches on it.

A name that could never have been defined — the wrong type, or not an identifier
— still fails with `invalid-name`. Answering "not found" would tell a caller the
name is available when it is not, and they would find out at `define`.

## Output

`NamedVariable`, or `undefined`. Already copied: `currentNamedVariable` clones at
the storage boundary, so what comes back shares nothing with the driver's row.

## Failures

| Error code | Cause |
| --- | --- |
| `invalid-name` | the name is not a string, or not an ASCII identifier |

## Procedure Tree

```text
get(scope, name)
├── record("get", { name })            ../shared/record.ts
├── canonicalName(name)                ../shared/canonical-name.ts
├── projectDatabase(scope.projectId)   $model/server/index.server
└── findVariable(database, nameKey)    ../shared/find-variable.ts
    └── currentVariable(row)           ../../persistence/stored-types.ts
```

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `canonicalName` / `nameKey` | a lookup must use the same key form the writer stored |
| `findVariable` | the read `define` and `require` also run |
| `record` | one trace per call, classified |

## See Also

[`require`](../require/require.md) — the same lookup, for a caller that cannot
continue without an answer.

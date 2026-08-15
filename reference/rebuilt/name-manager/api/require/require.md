# API: `require`

The strict retrieval form, for callers that cannot continue without the
declaration.

## Classification

- **Effect:** reader
- **Transaction:** none
- **Entry:** [`require.ts`](require.ts)
- **Browser-reachable:** yes, via [`require.remote.ts`](require.remote.ts)

## Signature

```ts
export const require = async (scope: Scope, name: string): Promise<NamedVariable>;
```

## Why it exists beside `get`

**Absence is a failure here, and that is the whole difference.**

Without it, every caller that cannot proceed writes the same throw — and one of
them eventually writes a different message, or a different code, for the same
condition. Stating it once means `variable-not-found` means one thing everywhere.

A resolver walking a formula's references is the caller this is for. It has no
useful branch for "that name does not exist" other than to stop, and stopping
with a code says more than stopping with a null dereference.

It is browser-reachable for the same reason it exists at all: the choice belongs
to the caller, and a view that could only reach `get` would reimplement this
every time it needed it.

## Output

`NamedVariable`. Already copied at the storage boundary.

## Failures

| Error code | Cause |
| --- | --- |
| `invalid-name` | the name is not a string, or not an ASCII identifier |
| `variable-not-found` | nothing is defined under that name |

Both are stated with a code, so a browser caller receives a `400` naming which
one it was rather than an opaque `500`.

## Procedure Tree

```text
require(scope, name)
├── record("require", { name })        ../shared/record.ts
├── canonicalName(name)                ../shared/canonical-name.ts
├── projectDatabase(scope.projectId)   $model/server/index.server
├── findVariable(database, nameKey)    ../shared/find-variable.ts
│   └── currentVariable(row)           ../../persistence/stored-types.ts
└── reject variable-not-found when absent
```

## Shared Procedures Used

| Procedure | Why this function needs it |
| --- | --- |
| `canonicalName` / `nameKey` | the same key form every reader and the writer use |
| `findVariable` | the read `get` and `define` also run |
| `record` | one trace per call, classified |

## See Also

[`get`](../get/get.md) — the same lookup, for a caller with a branch.

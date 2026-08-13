# API: `require`

`require` is the strict retrieval form, for callers whose next step is
impossible without the declaration. It differs from [`get`](../get/get.md) in
exactly one way: a name nobody has defined is a failure rather than an answer.

Prefer it wherever a missing declaration is a fault in the caller's inputs. The
resulting `variable-not-found` names the variable, which is more useful at the
point of failure than a `TypeError` some frames later.

## Classification

- **Owner:** `DataManager`
- **Execution:** accessor
- **Transaction:** none
- **Entry:** [`require.ts`](require.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `catalog` | `ReadonlyVariableCatalog` | The runtime's declarations, read-only |
| `name` | `string` | The name that must be defined. Matched ignoring case and surrounding whitespace |

## Output

`NamedVariable`

A copy of the complete declaration. There is no absent case.

## Failures

| Error code | Cause |
| ---------- | ----- |
| `invalid-name` | The argument is not a string, or is not an ASCII identifier once trimmed |
| `variable-not-found` | No declaration holds that name |

## Effects

None.

## Procedure Tree

```text
require(catalog, name)
  1. Canonicalize the required name.
  2. Read the catalog at that name's key.
     || no declaration is stored there
        2.a.1. Fail with variable-not-found, naming the canonical name.
  3. Return a copy of the declaration.
```

The lookup is repeated here rather than delegated to `get`, because a method
directory does not import from another method directory. The two shared
procedures the lookup is made of are what both methods actually share.

## Shared Procedures Used

| Procedure | Why this method needs it |
| --------- | ------------------------ |
| `canonicalName`, `nameKey` | The lookup must derive the same key `define` stored under, or a defined variable is reported not found |
| `copyVariable` | The caller must not receive a handle on the stored declaration |

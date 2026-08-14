# API: `get`

`get` answers whether a name is defined and, if it is, with what. Absence is an
ordinary answer here — callers that cannot proceed without the declaration
should use [`require`](../require/require.md) instead of testing for `undefined`
and throwing their own error.

## Classification

- **Owner:** `NameManager`
- **Execution:** accessor
- **Transaction:** none
- **Entry:** [`get.ts`](get.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `store` | `NameManagerStore` | Project-bound persistence port used for the lookup |
| `name` | `string` | The name to look up. Matched ignoring case and surrounding whitespace |

## Output

`Promise<NamedVariable | undefined>`

A copy of the complete declaration — name, schema, and value — or `undefined`
when no declaration holds that name.

## Failures

| Error code | Cause |
| ---------- | ----- |
| `invalid-name` | The argument is not a string, or is not an ASCII identifier once trimmed |

An unusable name is not the same question as an undefined one, so it fails
rather than returning `undefined`. `get("")` and `get("not a name")` cannot be
answered; `get("Unknown")` can.

## Effects

Reads the project's database catalog; it performs no durable mutation.

## Procedure Tree

```text
get(store, name)
  1. Canonicalize the lookup name.
  2. Query the store at that name's key.
     || no declaration is stored there
        2.a.1. Return undefined.
  3. Return a copy of the declaration.
```

## Shared Procedures Used

| Procedure | Why this method needs it |
| --------- | ------------------------ |
| `canonicalName`, `nameKey` | The lookup must derive the same key `define` stored under, or an existing name reads as absent |
| `copyVariable` | The caller must not receive a handle on the stored declaration |

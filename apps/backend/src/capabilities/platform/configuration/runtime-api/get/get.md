# API: `get`

Lives at `runtime-api/get/get.md`.

The only way to read a setting. Callers pass the dot-separated path of the key
they need — `server.port`, `logging.level` — and validate the result themselves.

## Classification

- **Owner:** `Configuration`
- **Execution:** accessor
- **Transaction:** none
- **Entry:** [`get.ts`](get.ts)

## Inputs

| Input | Type | Description |
| ----- | ---- | ----------- |
| `key` | `string` | A dot-separated path from the snapshot root. Segments name mapping keys in order. |

## Output

`unknown`

The configured value, or `undefined` when the path does not resolve. Objects and
arrays are returned frozen, as they sit in the snapshot.

## Failures

None. An unusable key is not an error here: an empty key, an empty segment, a
missing key, and a path that runs through a value instead of a mapping all
return `undefined`. The caller raises the error, because only the caller knows
whether the key it asked for is required.

## Effects

None. The method reads the frozen snapshot and returns.

## Procedure Tree

```text
receive key
  1. Split the key on ".".
     || the key is empty, or any segment is empty
        1.a.1. return undefined
  2. Walk the segments from the snapshot root, one mapping at a time.
     || the current value is not a mapping, or does not own the segment
        2.a.1. return undefined
  3. return the value reached by the final segment
```

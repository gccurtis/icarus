# Settings Types

Lives at `types/types.md`.

`types/` holds the canonical model and the public contract. It contains no stored row
shapes: a row's `value` is JSON text and carries `_id`, `_creationTime`, `projectId`, and
`updatedAt`, none of which a consumer should have to know about. Keeping the two apart is
what lets the storage change without reaching the contract.

## Files

| File | Holds |
| --- | --- |
| [`settings.ts`](settings.ts) | `Setting`, and `canonicalKey` |

`canonicalKey` sits here rather than in `api/shared/` because it defines what a key *is* —
two spellings that canonicalize alike are one setting, which is a statement about the model
rather than a step in a procedure. It is also the one piece both the capability and its
eventual tests need before any function runs.

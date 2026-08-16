# Documents Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`document.ts`](document.ts) | `Document`, and `documentTitle` |

## `Document` is not the row

It carries `id` — a document is reached by key, unlike an activity entry — and
drops `projectId`, which every row a caller receives shares with the project they
asked about.

It carries no revision and no body either, and that is not a projection: neither
is on the row. The current revision is the highest change set's, read from an
index in pass 2, so putting it here would turn a one-range list read into a
lookup per document.

## `documentTitle` sits here rather than in `api/shared/`

It says what a title *is* — trimmed, and never empty — which is a statement about
the model rather than a step in a procedure. Same reason
[`settings`](../../settings/types/types.md) keeps `canonicalKey` in `types/`.

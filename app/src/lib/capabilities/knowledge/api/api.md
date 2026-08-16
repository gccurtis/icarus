# Knowledge API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`status/`](status/status.md) | `status` | query — what the project's lattice is, or nothing |
| [`shared/`](shared/shared.md) | — | `ingest`, and the version invariant every writer goes through |

## Ingestion is not a registered function, and that is not an omission

**Embedding is a network call, and a Convex mutation cannot make one.** `ingest`
is the transactional half of an action: something outside the transaction
resolves the `embedding` binding, calls the provider, and hands the vectors down.
That outside half is the intelligence capability, which does not exist yet.

Registering it now would mean a door that either fabricates an embedder or throws
on every call. Both read, from the outside, as a feature that is there.

So it sits in `shared/`, which is where the standard puts a procedure the door
does not name — and it already has the second caller that justifies promotion
waiting for it: the clustering pass reads the level-0 nodes ingestion leaves
behind.

## Retrieval is not here either

Descent needs levels above 0 to descend, and nothing above 0 exists until
clustering runs. A search function over a flat level 0 would be a different
algorithm with the same name.

# Knowledge API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`status/`](status/status.md) | `status` | query — what the project's lattice is, or nothing |
| [`cluster/`](cluster/cluster.md) | `cluster` | mutation — one clustering pass: source tiers, then the corpus tier |
| [`shared/`](shared/shared.md) | — | `ingest`, the version invariant every writer goes through, and the level index |

## Ingestion is not a registered function, and that is not an omission

**Embedding is a network call, and a Convex mutation cannot make one.** `ingest`
is the transactional half of an action: something outside the transaction
resolves the `embedding` binding, calls the provider, and hands the vectors down.
That outside half is the intelligence capability, which does not exist yet.

Registering it now would mean a door that either fabricates an embedder or throws
on every call. Both read, from the outside, as a feature that is there.

So it sits in `shared/`, which is where the standard puts a procedure the door
does not name — and it has the second caller that justifies promotion: the
clustering pass reads the level-0 nodes ingestion leaves behind.

**Clustering is registered, and the contrast is the reason.** It reads vectors
that are already stored and writes rows, with no provider in it at all. Nothing
has to exist before it can be called, so nothing is gained by hiding it.

## Retrieval is not here either

Descent arrives with regions. It needs the levels `cluster` builds; a search over
a flat level 0 would be a different algorithm with the same name.

The level index it will narrow the frontier with is already written, by
[`cluster`](cluster/cluster.md) — it is the by-product of clustering a pool too
large to compare in full, so producing it costs nothing extra and holding it back
would mean fitting the same basis twice.

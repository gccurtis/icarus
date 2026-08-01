# Knowledge types

Public values are declared in [`types.ts`](../types.ts), the persistence port in [`store.ts`](../store.ts), and embedding seam in [`embedder.ts`](../embedder.ts).

## Identity sentinels

`WINDOW_PREFIX` is `w:` and `NODE_PREFIX` is `n:`. `isWindowId(id)` checks only `startsWith("w:")`; it does not validate the hash suffix or stored existence.

## Windowing types

| Type | Fields | Notes |
| --- | --- | --- |
| `WindowOptions` | `targetRunes`, `overlapRunes` | Numbers are not runtime-validated; implementation counts JS string characters |
| `WindowPiece` | `start`, `end`, `text`, `ordinal` | Pre-embedding positioned chunk |

## Stored artifacts

| Type | Key fields | Meaning |
| --- | --- | --- |
| `KnowledgeWindow` | ID/source/label, ordinal/offsets/text, embedding | Smallest persisted retrievable artifact |
| `KnowledgeNode` | ID, optional source, level, centroid, count, cohesion, member IDs | Derived lattice cluster |
| `SourceRecord` | source/label/revision, window count/bytes, added/synced dates | Source registry metadata; source body is not duplicated here |
| `FrontierEntry` | ID, vector, `isWindow` | Corpus descent entry |

Type comments describe embeddings/centroids as unit-normalized. `centroid` normalizes constructed node centroids, but the runtime does not normalize or validate provider-returned window embeddings.

## Retrieval types

| Type | Fields | Semantics |
| --- | --- | --- |
| `Region` | source/label, start/end/text, relevance/density | Merged retrieved span |
| `KnowledgeRetrievalOptions` | optional `topK`, `scope`, `scopeManifest` | `topK` is currently ignored; an explicitly present `scopeManifest` property takes precedence over `scope` |
| `RetrieveResult` | `regions`, `scope`, `usage` | Scope is null for unscoped calls |

## Scope types

| Type | Purpose |
| --- | --- |
| `ContextEntry` | Generic reference atom `{ id, kind }` |
| `KnowledgeResourceDescriptor` | Source ID mapped to public resource ID/kind and optional numeric revision |
| `KnowledgeScopeManifest` | Canonical input, resolver output, descriptors, admissible IDs, two digests, timestamp |
| `KnowledgeResourceResolver` | `resolve(entries)` plus optional `describeSource(sourceId)` |

`KnowledgeScopeManifest` fields are readonly at the type level. Manifests produced by `resolveScope` are also runtime-frozen. `retrieve` accepts any structurally compatible caller-supplied manifest and does not authenticate its provenance.

## Ingest and event types

| Type | Fields/behavior |
| --- | --- |
| `AddItem` | source ID, label, optional revision, optional text, optional stream |
| `AddResult` | source ID, skipped flag, added/reused window counts, embedding usage |
| `KnowledgeSourceMutation` | `operation: add | remove`, `sourceId` |
| `KnowledgeSourceMutationListener` | synchronous callback returning `void` |

If both `text` and `stream` are present, text wins. If neither is present, empty text is ingested. There is no discriminated union enforcing exactly one input form.

## Configuration types

| Type | Fields | Current use |
| --- | --- | --- |
| `KNNConfig` | `k`, `pcaDims`, optional cells, exact/sparse crossover, repair fraction/drift | clustering uses first four; repair helper uses fraction; drift is not used |
| `ClusterConfig` | percentile, floor, KNN config | source/corpus clustering |
| `KnowledgeOptions` | partial window/cluster, descent beam/threshold, char budget, default topK, resolver | `defaultTopK` is stored but never read after construction |

Defaults live beside implementations: [`DEFAULT_WINDOW_OPTIONS`](../windowing/text.ts), [`DEFAULT_CLUSTER_CONFIG`](../lattice/cluster.ts), [`DEFAULT_BEAM`/`DEFAULT_THRESHOLD`](../lattice/descent.ts), and [`DEFAULT_CHAR_BUDGET`](../lattice/regions.ts).

## Stored approximate-index types

| Type | Shape |
| --- | --- |
| `StoredLevelIndex` | level, threshold, k, PCA basis, IVF centroids, artifact records |
| `StoredArtifactEntry` | artifact ID, cell, neighbor edges |
| `StoredEdge` | target ID and similarity |

`buildLevelIndex` can construct this value and `KnowledgeStore` can persist it, but the active Knowledge add/retrieve paths never call either function/store operation.

## Auxiliary algorithm types

| Source | Types |
| --- | --- |
| [`cluster.ts`](../lattice/cluster.ts) | `Artifact`, `SourceLatticeResult`, `CorpusLatticeResult` |
| [`knn.ts`](../lattice/knn.ts) | `Neighbor`, `KNNGraphResult` |
| [`descent.ts`](../lattice/descent.ts) | `DescentResult` |
| [`repair.ts`](../lattice/repair.ts) | `RepairInput`, `RepairResult` |

These are exported from the lattice barrel, not from the top-level Knowledge barrel except for core platform types.

## Ports

`Embedder.embed(inputs)` returns vectors and Intelligence `Usage`. `IntelligenceEmbedder` supplies the production implementation and intentionally drops provider/model metadata.

`KnowledgeStore` has 17 asynchronous methods grouped into sources, windows, nodes, frontier, and stored level indices. The store instance itself represents one project; no method accepts a project ID. See [Runtime](runtime.md) for every method and [Database types](../../database/docs/types.md) for the SQLite encoding.

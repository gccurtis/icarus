# Knowledge runtime

## Construction

[`createKnowledge`](../../../1-init/create/knowledge.ts) constructs:

1. `SQLiteKnowledgeStore(projectId, "./data/knowledge.db")`;
2. `IntelligenceEmbedder(intelligence)`;
3. `Knowledge(store, embedder, logger, { resolver })`.

The constructor merges supplied options with defaults and retains one optional resource resolver. It does not validate numeric option ranges.

## `Knowledge` public methods

| Method | Behavior | Writes / external work |
| --- | --- | --- |
| `onSourceMutation(listener)` | Registers ordered synchronous listener; returns unsubscribe closure | In-memory listener set |
| `add(item)` | Collect, revision-check, window, reuse/embed, replace lattice, record source, notify | Store writes, embedding calls, logs/listeners |
| `remove(sourceId)` | Delete source artifacts/record, rebuild corpus, notify | Store writes, logs/listeners |
| `listSources()` | Delegate to store | Read only |
| `resolveScope(scope?)` | Resolve/canonicalize/freeze entries, descriptors, IDs, digests | Store/resolver reads; timestamp |
| `retrieve(query, options?)` | Embed, resolve/reuse scope, descend, filter, merge/budget | Embedding/store/resolver reads; debug log except early empty path |
| `searchTool()` | Return `knowledge_search` binding whose handler calls unscoped `retrieve` | Work occurs when handler executes |

## `add` details

Text input is preferred over stream; a stream is fully collected by `collectStream`; neither means empty text. A nonempty matching revision returns zero usage and logs `knowledge.add.skipped` without emitting a mutation.

The runtime windows text, hashes each window, asks the store for all matching IDs, and embeds missing pieces in batches of 32. It assumes one vector per batch entry and reads `vectors[j]` without cardinality checks. It then replaces source windows/nodes, rebuilds the entire corpus tier, upserts the source record, emits the event, and logs counts/usage/duration.

Embedding reuse is based only on window ID. The reported `windowsReused` is the size of the existing-ID map, not necessarily the count of occurrences in the new piece list.

## Scope methods

`canonicalEntries` copies/sorts entries by kind then ID. `resolveScope` uses all stored sources for an explicit empty array, otherwise delegates to the resolver or filters exact `document` kinds. Resolved IDs are unique/sorted; resource descriptors are resolver-provided or default to identity-as-document. It freezes copies and computes:

- `contextDigest = SHA-256(JSON canonical input entries)`;
- `scopeDigest = SHA-256(JSON sorted resource descriptors)`.

In `retrieve`, the mere presence of the `scopeManifest` property controls selection. `{ scopeManifest: null, scope: [...] }` is unscoped. Otherwise `scope` is resolved at call time.

## Retrieval helpers

[`descent`](../lattice/descent.ts) scores all frontier entries, processes the best `beam` candidates per loop, follows nodes over a threshold, caps node expansions at 256, and records reached windows. Despite an internal comment about trimming, `insertSorted` does not cap the active array; `beam` controls batch size rather than a strict frontier width. There is no fallback scan.

[`assembleRegions`](../lattice/regions.ts) groups by source, merges overlapping/touching windows, reconstructs text, sorts by relevance then density, always admits the first region, and admits later regions within a 4,000-character default budget. Dense spans use 125% of that budget. The `topK` option is not applied.

## Windowing functions

| Function/object | Methods | Current role |
| --- | --- | --- |
| `windowText` | pure function | Used by `Knowledge.add` after full input collection |
| `StreamWindower` | constructor, `write`, `close` | Exported standalone utility; not used by `Knowledge` |
| `findSentences` | private helper | newline/punctuation/hard-split scanning |

`StreamWindower` maintains scanner/window state and an overlap buffer. Its stated equivalence with `windowText` is not covered by tests, especially across multiple partial-sentence chunks.

## Lattice construction

| Function | Responsibility |
| --- | --- |
| `makeWindowId` / `makeNodeId` | Stable truncated SHA-256 IDs |
| `buildSourceLattice` | Repeated greedy clique clustering into source nodes/frontier |
| `buildCorpusTier` | Reuse source-lattice algorithm over union of source frontiers, then clear source IDs |
| `buildSimilarityMatrix` / `estimateThreshold` | Exact similarity and percentile/floor threshold |
| `buildKNNGraph` | Deterministic PCA/IVF candidate graph with exact rerank |
| `fitProjection` / `projectVector` | Projection support |
| `buildLevelIndex` | Convert neighbor graph to persistable index; inactive in runtime path |
| `repairCorpus` | Optional local-repair helper; imported but never called by `Knowledge` |

`clusterLevel`, `findCliques`, and `kMeans` are internal helpers. Math support includes dot/norm/normalize/centroid/cohesion/orthonormalization plus deterministic `Xorshift`.

### Auxiliary function index

| File | Functions/classes and exact role |
| --- | --- |
| [`lattice/math.ts`](../lattice/math.ts) | `dot`, `norm`, `normalize`, `cosineSim`, `centroid`, `minPairwiseSim`, `buildSimilarityMatrix`, `estimateThreshold`, in-place `orthonormalize`, and deterministic `Xorshift.next/uniform/intn` |
| [`lattice/knn.ts`](../lattice/knn.ts) | `fitProjection`, `projectVector`, private `kMeans`, `buildKNNGraph`, and inactive `buildLevelIndex` serialization |
| [`lattice/cluster.ts`](../lattice/cluster.ts) | ID makers, private `findCliques`/`clusterLevel`, `buildSourceLattice`, and `buildCorpusTier` |
| [`lattice/descent.ts`](../lattice/descent.ts) | `descent` plus private descending-array `insertSorted` |
| [`lattice/regions.ts`](../lattice/regions.ts) | `assembleRegions` grouping, merging, sorting, and budget admission |
| [`lattice/repair.ts`](../lattice/repair.ts) | inactive `repairCorpus` source/corpus reconstruction helper |
| [`windowing/text.ts`](../windowing/text.ts) | private `findSentences` and public `windowText` |
| [`windowing/stream.ts`](../windowing/stream.ts) | `StreamWindower.write/close` and its scanner/window-buffer helpers |

## Corpus rebuild

`rebuildCorpusTier(changedSourceId, newSourceFrontier)` starts with the changed source's newly computed frontier. For every other listed source, it reads all source node IDs and treats every returned node as a frontier entry, even though the comment says top-level nodes only. For a node-less existing source, `getWindowIds` returns no IDs, so its single-window frontier is not reconstructed. It then replaces corpus nodes/frontier.

These behaviors are part of current source and are important maintenance limitations; see [Invariants](invariants.md).

## Mutation listeners

`emitSourceMutation` invokes every listener synchronously in insertion order. It continues after failures, remembers the first error, logs one generic listener-failure record, then throws. The source mutation is already persisted, so a listener error makes the API reject after state changed. Skipped adds do not notify.

At startup, Derived Outputs registers a listener that advances its Knowledge generation and marks outputs stale.

## Logging and usage

- skipped add: debug with source ID/label/revision;
- completed add/remove: info with safe counts, usage, and duration;
- nonempty retrieval path: debug with hit/scope/region/usage/duration;
- listener error: error kind and operation.

An empty descent returns before retrieval telemetry. Add/remove/retrieve failures have no Knowledge-level failure log. Knowledge's batch `addUsage` currently drops optional `costUsd`, so multi-batch ingestion cost is not retained in its returned aggregate.

# Knowledge invariants and guarantees

## Source and identity guarantees

| Preconditions | Guaranteed result |
| --- | --- |
| Existing source has the same nonempty caller revision | `add` skips embedding and persistence, returns zero usage, emits no mutation |
| A new window ID matches a persisted window | Its stored embedding is reused |
| `makeWindowId` receives identical source ID/text | It returns the same `w:` ID |
| `makeNodeId` receives the same member-ID multiset/order variants | Sorting yields the same `n:` ID |
| A non-skipped add reaches completion | Source record, current windows/lattice/frontier are written before listeners run |
| Remove reaches completion | Explicit source windows/nodes/record are deleted and corpus is rebuilt before listeners run |

Hashes are truncated; collision detection is absent. Repeated identical window text inside one source also produces the same ID because position/ordinal are excluded.

## Retrieval guarantees

- Returned region text is assembled only from persisted window text; retrieval does not reopen source resources.
- Regions contain one source each and merge overlapping/touching reached windows.
- Relevance is the best covering-window score; density is covering-window count.
- The highest-ranked region is admitted even when it alone exceeds the character budget.
- A non-null manifest filters reached windows by its `resolvedSourceIds` before region assembly.
- The exact selected manifest object is returned with the result.
- No qualifying descent result yields an empty region list; there is no full scan fallback.

“Verbatim” applies to window material. When an unexpected gap exists between windows, region reconstruction appends available window text rather than reopening the omitted gap.

## Scope guarantees

`resolveScope` makes sorted copies and freezes the produced manifest graph. Equivalent ordered multisets of input entries give the same context digest; equivalent sorted resource descriptor arrays give the same scope digest. Input duplicates remain significant to `contextDigest`. Resource/source membership is a point-in-time snapshot and is not automatically re-resolved during retrieval.

Manifest provenance is a trust convention, not a cryptographic capability: `retrieve` accepts a structurally supplied manifest without verifying its digest/frozen state or consulting the resolver again.

## Mutation-event guarantees

Listeners run synchronously, in registration order, only after non-skipped persistence completes. All listeners are attempted even if one throws, and the first error is rethrown afterward. Consequently, successful persistence does not guarantee that `add/remove` resolves successfully.

## Algorithm assumptions

Clustering/descent cosine calculations assume equal-dimension, finite, unit-normalized vectors. Node centroids are normalized, but provider-returned window/query vectors are accepted without validation or normalization. A provider cardinality mismatch can store `undefined` as an embedding or fail later.

Numeric configuration values are not range-checked. Zero/negative beam, budgets, target sizes, thresholds, or KNN settings may produce degenerate behavior.

## Atomicity and concurrency limits

One source mutation spans multiple independent store calls. There is no Knowledge mutex, compare-and-swap, transaction envelope, pending state, or startup reconciliation. Concurrent add/remove operations can retarget the shared corpus frontier based on interleaved reads/writes unless owning jobs serialize them. Current Connector and General File logic provides capability-level reconciliation but cannot make the Knowledge database mutation itself atomic.

A listener-backed Derived generation fences output publication after completed Knowledge mutations; it does not roll back or repair a partially failed Knowledge mutation.

## Current correctness limitations

- Scoped filtering occurs after bounded global descent, so a scoped relevant window may never be reached.
- `topK` and `defaultTopK` are unused.
- Stored level indices are neither built nor read by active runtime paths.
- `repairCorpus` is not called; active changes always rebuild corpus tier.
- `repairMaxDrift` is unused, including inside the repair helper.
- Corpus rebuild treats every source node as top-level.
- An unchanged, existing source with no cluster nodes cannot have its window frontier reconstructed by `getWindowIds`; it can disappear from the corpus frontier when another source changes.
- Stream ingestion buffers the whole source; `StreamWindower` is not integrated.
- Multi-batch `addUsage` omits `costUsd`.
- Empty-descent retrieval returns before its debug telemetry.
- Source/window/node/frontier updates are not one transaction.

## Non-guarantees

Knowledge does not guarantee semantic relevance, exhaustive recall, factuality, stable scores across embedding-model changes, exact top-K results, authenticated scopes, public-resource availability after indexing, or cancellation of embedding work. It does not persist the embedding provider/model/revision alongside windows.

## Tests and change checklist

Direct coverage currently pins mutation invalidation/fencing through [`derived-outputs.test.ts`](../../../../test/capabilities/derived-outputs.test.ts), not the full runtime. Needed focused tests include:

- batch and multi-chunk windowing equivalence, Unicode offsets, overlap, repeated text;
- exact/sparse lattice determinism and frontier membership;
- single-window and multi-source corpus rebuilds;
- vector cardinality/dimension/normalization failures;
- scoped recall, manifest precedence, digest/duplicate semantics;
- region reconstruction and budgets;
- listener failure-after-commit semantics;
- concurrent/partial source mutations and recovery;
- real SQLite round trips and restart retrieval;
- Logger fields for success, empty results, and failures.

Changes to IDs, window geometry, embeddings, or cluster configuration can invalidate persisted derived state. No migration/reindex version is currently stored, so such changes require an explicit rebuild strategy.

# Semantic Overlay

The project-scoped bridge from authoritative resource text to indexed retrieval.

- Accepted document and slide-deck mutations call `enqueueSemanticSyncFor`,
  which revision-coalesces work in persisted `semanticSyncJobs` rows.
- `readSemanticResource` projects a leader snapshot into canonical UTF-16 text
  and locator spans. Prompt blocks are excluded so generated output cannot
  become recursive evidence.
- `processSemanticSyncQueue` claims a bounded batch. `syncSemanticResource`
  runs token-field embedding, deterministic segmentation, contextual passage
  embedding, a latest-revision check, and guarded publication.
- `publishSemanticTranslation` stages the full successor index before retiring
  the previous source objects and snapshots retired evidence by value.
- `backfillSemanticOverlay` enumerates document/deck leaders and joins the same
  queue and worker path used by normal authoring.

- `rebuildSemanticIndex` deterministically clusters every active object, writes
  a replacement tree, publishes its roots, and only then retires the old tree.
- `querySemanticOverlay` embeds one query with Jina's `retrieval.query` task,
  applies the optional resource set, traverses centroids best-first, scores the
  candidate objects exactly, coalesces overlapping source spans, and attaches
  intersecting resource locators before applying `topK`.

No public procedure accepts a project ID. The request scope provides the project,
and every joined table is filtered to it before use.

The current JSON store has no cross-table transaction, so the leader write and
queue write are adjacent rather than atomic. The queue is durable, but an
always-on worker host/recovery loop is still deployment infrastructure; the
bounded processor is explicit in this slice.

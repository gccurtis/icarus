# Semantic Overlay

The project-scoped bridge from active semantic-object rows to indexed retrieval.

- `rebuildSemanticIndex` deterministically clusters every active object, writes
  a replacement tree, publishes its roots, and only then retires the old tree.
- `querySemanticOverlay` embeds one query with Jina's `retrieval.query` task,
  applies the optional resource set, traverses centroids best-first, scores the
  candidate objects exactly, and coalesces overlapping source spans before
  applying `topK`.

Neither procedure accepts a project ID. The request scope provides the project,
and every joined table is filtered to it before use.

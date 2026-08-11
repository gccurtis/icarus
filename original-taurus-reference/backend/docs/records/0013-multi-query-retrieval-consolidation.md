# 0013 — Multi-query retrieval consolidation

Prompt-block resolution fans one prompt out into several retrieval queries, then
had to pool the results itself. That pooling only **exact-deduped** spans by
`(sourceType, sourceID, start, end)`: two queries that surfaced *overlapping but
not identical* regions of the same source produced two overlapping evidence items,
whose overlap text was sent to synthesis twice. Within a single query the
knowledge layer already merges overlapping windows into widest regions
(`mergeWindows`); the gap was purely across queries.

This moves the cross-query pooling into the knowledge layer, where the merge logic
and the source snapshot (for union text) already live, and reshapes the document
`Retriever` port to take the whole query set at once.

## core/capability/knowledge/knowledge.go

### RetrieveMany — pool + merge across queries

```go
func (k *Knowledge) RetrieveMany(ctx, projectID string, queries []string, topK int) (RetrieveResult, error) {
	// embed all queries in one call; identity-check once; load candidates once
	regions, err := k.regionsFor(poolRankings(qvecs, candidates, topK))
	// ...
}
func poolRankings(qvecs [][]float64, windows []Window, topK int) []scoredWindow { /* union per-query top-k, best score per window */ }
```

**What it does:** runs the existing pipeline once for the whole query set —
embeds all queries in a single round-trip, identity-checks once, loads candidate
windows once (exact scan for all; descent unions per-query walks), then
`poolRankings` ranks the candidates against each query and unions the per-query
top-k keeping each window's best score. Feeding that to the same
`regionsFor`/`mergeWindows` path consolidates overlapping/touching windows
**across queries** into single widest regions with union text. **Goal / why:** one
non-overlapping, deduplicated region set spanning every query's angle — the
grouping the user asked for ("if two ranges overlap, make one widest range") —
computed where the source snapshot exists, so union text is correct and the merge
logic isn't duplicated in the document layer. `Retrieve` (single query) stays for
the dev retrieval endpoint.

## core/capability/document/prompt.go

### Retriever port takes the query set; ResolveBlock stops pooling

```go
type Retriever interface {
	Retrieve(ctx, projectID string, queries []string, topK int) ([]EvidenceSpan, Usage, error)
	// ...
}
// ResolveBlock:
evidence, u, err := d.retriever.Retrieve(ctx, projectID, queries, d.promptTopK)
```

**What it does:** the port now takes `[]string` and returns the already-pooled set;
`ResolveBlock`'s per-query loop + manual dedup is gone. **Why:** the knowledge
layer owns pooling/merging now, so the document layer just passes the queries and
receives a clean set — one embed round-trip instead of one per query, and no
double-counted overlaps.

## core/wiring/wiring.go

### Adapter calls RetrieveMany, carries relevance

```go
func (r documentRetriever) Retrieve(ctx, projectID string, queries []string, topK int) (...) {
	res, err := r.know.RetrieveMany(ctx, projectID, queries, topK)
	// map each region -> EvidenceSpan{..., Relevance: rg.Relevance}
}
```

**What it does / why:** the `documentRetriever` adapter forwards the whole query
set to `RetrieveMany` and maps each consolidated region to an `EvidenceSpan`,
including the `Relevance` score (see 0013's companion — relevance carried onto
evidence). Pooling happens once, in knowledge.

## Tests

- `knowledge`: `TestRetrieveManyPoolsAcrossQueries` — two queries over one source
  surface both topics in one consolidated, non-duplicated set, where a single query
  surfaces only its own.
- `document`: the old cross-query max-relevance test is replaced by
  `TestResolveBlockCarriesRelevance` (the document layer now just carries the
  retriever's relevance onto stored evidence); the pipeline test's usage math drops
  to a single retrieve call.

## Docs

Updated the [prompt-resolution flow](../architecture/workflows/prompt-resolution.md)
(Retrieve stage + mermaid now one `RetrieveMany` call) and the `prompt.go.md`,
`wiring.go.md`, and `knowledge.go.md` sidecars.

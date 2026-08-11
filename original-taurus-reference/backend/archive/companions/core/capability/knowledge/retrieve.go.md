# retrieve.go

`retrieve.go` is the read half of the lattice. Every entry point here follows the
same four steps: embed the query (or queries), guard that the result lives in the
same vector space as the stored sources, choose a candidate window set, then rank
those windows and resolve the winners into grounded, cited regions.

What differs between the entry points is only *how the candidate set is chosen*.
`Retrieve` and `RetrieveMany` descend the lattice
([`descent.go`](descent.go.md)) — always; there is no retrieval mode to choose.
`RetrieveExact` is the reference algorithm (rank every window, no pruning), a
separate named function tests hold descent to rather than a flag production
picks from. `RetrieveScopedMany` needs neither, because an explicit allow-list
already bounds the candidates. Region
assembly — merging overlapping windows, applying the character budget, attaching
citations — belongs to [`regions.go`](regions.go.md); this file only decides what
to rank and hands the ranking over.

Three invariants recur and are worth stating once. All stored and query vectors
are unit-normalized, so similarity is a plain dot product. Every path performs
the identity guard before comparing anything, because a mismatch means the
embedding route changed since a source was added and scores across spaces are
meaningless. And no path is allowed to return an empty answer that the exact scan
would have filled — descent always has a fallback.

## Code breakdown

### Retrieve, RetrieveExact and queryVector

`Retrieve` is the full pipeline for one query: `queryVector` embeds it,
normalizes, reads `Identities` (identities only — never source text) and
refuses with `ErrIdentityMismatch` if any stored source was embedded in a
different space (a zero identity predates stamping and is grandfathered; a
project with no identities is simply empty and returns no regions). Then
descent, unconditionally — nothing but the walked frontier is read — with one
fallback: if the thresholds pruned every path and descent surfaced no
candidates, the exact windows are loaded and the mode is reported as
`"exact-fallback"` rather than returning an empty result. Presence of
candidates is the decision, the same pattern as everywhere in this package.

`RetrieveExact` shares `queryVector` and then ranks every window. It exists as
a deliberately separate, named function — the reference oracle — because
comparing descent to the exact scan is a test's job, not a production audit:
the unit tests hold `Retrieve` to it on deterministic fixtures, and a dev
harness may call it live. Production traffic never chooses between the two.

### windowsForOrigins — loading exactly the scoped sources

Resolves each allowed `Origin` to its source and loads that source's windows,
deduplicating by `LocalRefID` and silently skipping origins that are not
registered. Its guarantee is negative and deliberate: it never reads a window
belonging to a source outside the allow-list.

### RetrieveScopedMany — retrieval bounded to an allow-list

Ranks several queries only within the allowed sources. It bypasses directed
descent entirely — the candidate set is already bounded by the scope, so there
is nothing to prune and it ranks those windows exactly.

Two guards shape the empty cases differently, and the difference is intentional:
an empty allow-set returns `Mode: "scoped"` with no regions (the scope was
honoured, it just admits nothing), whereas queries that are all blank return a
zero result with no mode and, importantly, no embed call — blank input never
costs a provider round-trip. The same identity guard as the unscoped path
applies.

### RetrieveMany — several queries, one consolidated region set

The grouping a caller that fans one prompt out into several retrieval queries
wants. All the queries are embedded in a single call, which keeps it one
round-trip and also means one identity comparison covers every query vector.

Candidate selection mirrors `Retrieve` but unions across queries: descent
walks the lattice per query and unions what each surfaces, deduplicating by
window id. The same `"exact-fallback"` rule applies if descent prunes
everything. Each query then
contributes its top-k, the rankings are pooled, and region merging folds
overlapping or touching windows — across all the queries — into single widest
regions, so the caller never sees the same span twice and adjacent hits arrive
as one region rather than a pile of fragments.

### poolRankings — union of per-query top-k, best score wins

Ranks the candidates against each query separately and unions the per-query
top-k, keeping each window's *best* score across the queries:

```go
if cur, ok := best[sw.w.ID]; !ok || sw.score > cur.score {
	best[sw.w.ID] = sw
}
```

A window surfaced by two queries is therefore counted once, at the score of
whichever query matched it best. The output is intentionally unordered — it
comes from a map — because region merging is what imposes the final grouping.

### regionsFor — resolving ranked windows into cited regions

Collects the distinct `LocalRefID`s of the ranked windows and loads only those
sources, then hands the ranking and the sources to `buildRegions` with the
character budget. This is the narrow-read discipline at the last step: source
text is fetched only for the sources that actually made the answer.

### scoredWindow and rankWindows — exact scoring with a stable order

`scoredWindow` pairs a window with its query similarity. `rankWindows` scores
every candidate by dot product, sorts descending, and truncates to top-k. The
tie-break on window id (`ranked[i].w.ID < ranked[j].w.ID`) is not cosmetic — it
makes retrieval deterministic when scores collide, which is what allows the
descent audit to compare two rankings meaningfully and lets tests assert on
exact results.

### `regionsFor` — two narrow reads instead of one wide one

It now loads the ranked windows' content (`WindowContent`) alongside the sources
those windows belong to.

The sources are still needed: a region has to name its origin to be citable. What
they no longer supply is the **text**, which comes from the windows — the artifacts
actually being cited. Both reads are bounded by the ranked set, so the cost of
answering a query stops scaling with the size of whichever sources the top-k happened
to hit. Previously a query touching one window of a 5MB source loaded all 5MB.

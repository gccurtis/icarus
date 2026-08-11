# regions.go

`regions.go` turns ranked retrieval windows into the unit a caller actually
receives: the `Region`, a merged, verbatim, contiguous span of one source. Raw
top-k window hits misbehave in two ways — adjacent windows overlap (they share
trailing sentences), so the same text can come back twice, and a passage the
query genuinely matches gets fragmented across several hits. Merging repairs
both: retrieved windows of the same source that overlap or touch collapse into
one span, carrying the best covering window's relevance and a density count of
how many retrieved windows converged on it. The output is then budgeted:
regions are admitted in rank order under a character budget, with a controlled
overage for dense regions and the top region always admitted, so a result is
never empty just because the best answer was large.

The file is pure computation over data `Retrieve` has already loaded — no
ports, no I/O, no state. `buildRegions` is the single entry point: both the
exact scan and the descent path hand it their ranked windows, with
`mergeWindows` doing the dedup-and-merge and `resolveRegion` slicing the exact
span text and its covered blocks out of the source. The grounding invariant
holds throughout: region text is always an exact slice of the source snapshot,
never synthesized.

## Code breakdown

### Package declaration and import

```go
package knowledge

import "sort"
```

The file lives in the same `knowledge` package as `Retrieve`, which calls it,
and the `Source`, `BlockRef` and `scoredWindow` types it consumes. Its only
import is `sort`, used three times below: ranking merged regions, ordering a
source's windows before the interval merge, and the deterministic tie-breaks
inside both.

### The Region type

```go
// Region is the grounded retrieval unit: a merged, verbatim, contiguous span of
// one source. Raw top-k windows overlap (adjacent windows share trailing
// sentences) and fragment context; regions repair both — retrieved windows of
// the same source that overlap or touch are merged into one span, carrying the
// best covering window's relevance and a density count of how many retrieved
// windows converged on it. Text is always an exact slice of the source
// snapshot, and Blocks names the origin components the span touches.
type Region struct {
	SourceType string     `json:"sourceType"`
	SourceID   string     `json:"sourceId"`
	Start      int        `json:"start"`
	End        int        `json:"end"`
	Relevance  float64    `json:"relevance"`
	Density    int        `json:"density"`
	Text       string     `json:"text"`
	Blocks     []BlockRef `json:"blocks,omitempty"`
}
```

`Region` is what a retrieval returns, and its doc comment carries the
rationale: raw top-k windows overlap and fragment context, and regions repair
both. It reports the origin's own `(SourceType, SourceID)` rather than the
internal `LocalRefID`, with `[Start, End)` locating the span in the source
snapshot. `Relevance` is the best covering window's score — a merge never
averages a strong match down — and `Density` counts how many retrieved windows
converged on the span, a signal the budget logic below reads as importance.
`Text` is the exact slice, and `Blocks` names the origin components the span
touches, so a region cites real document addresses just as the raw window hits
did; the `omitempty` keeps it out of the JSON when the source registered no
block map.

### Building budgeted regions

```go
// buildRegions turns ranked windows into budgeted regions: merge per source,
// rank by relevance (density, then position, breaking ties), then admit regions
// in rank order under the character budget — with a controlled overage for
// dense regions, and the top region always admitted so a result is never empty
// because the best answer was large.
func buildRegions(ranked []scoredWindow, sources map[string]Source, budget int) []Region {
	if len(ranked) == 0 {
		return nil
	}
	regions := mergeWindows(ranked, sources)
	sort.Slice(regions, func(i, j int) bool {
		if regions[i].Relevance != regions[j].Relevance {
			return regions[i].Relevance > regions[j].Relevance
		}
		if regions[i].Density != regions[j].Density {
			return regions[i].Density > regions[j].Density
		}
		if regions[i].SourceID != regions[j].SourceID {
			return regions[i].SourceID < regions[j].SourceID
		}
		return regions[i].Start < regions[j].Start
	})

	// Admit under the budget. A dense region (several windows converged on it)
	// may overrun by up to a quarter of the budget; the top region is always
	// admitted.
	var out []Region
	used := 0
	for _, r := range regions {
		size := len(r.Text)
		switch {
		case len(out) == 0:
			// always
		case used+size <= budget:
			// fits
		case r.Density >= 2 && used+size <= budget+budget/4:
			// controlled dense overage
		default:
			continue
		}
		out = append(out, r)
		used += size
		if used >= budget {
			break
		}
	}
	return out
}
```

`buildRegions` is the whole pipeline in one function: merge, rank, admit. An
empty ranking short-circuits to nil. Otherwise `mergeWindows` produces the
merged regions and the sort fixes the admission order — relevance first,
density breaking ties (of two equally-scored regions, the one more windows
converged on ranks higher), then source id and start position, so the order and
therefore the admitted set is fully deterministic regardless of map iteration
in the merge.

The admission loop then spends the budget in that order, and the `switch` names
the three ways in. The first region is always admitted — the top-ranked answer
is never dropped, even when it alone exceeds the budget. A region that fits in
the remaining budget is admitted. And a dense region (`Density >= 2` — several
windows converged on it) may overrun by up to a quarter of the budget, the
controlled exception for spans the retrieval strongly agrees on. Everything
else is skipped with `continue` rather than `break`, so a smaller region later
in the ranking can still use the remaining room; only once the running total
reaches the budget does the loop stop for good.

### Merging windows into regions

```go
// mergeWindows deduplicates the ranked windows and merges, per source, every
// overlapping or touching span into one region. Relevance is the best covering
// window's score; density counts the covering windows.
func mergeWindows(ranked []scoredWindow, sources map[string]Source) []Region {
	seen := map[string]bool{}
	bySource := map[string][]scoredWindow{}
	for _, r := range ranked {
		if seen[r.w.ID] {
			continue
		}
		seen[r.w.ID] = true
		bySource[r.w.LocalRefID] = append(bySource[r.w.LocalRefID], r)
	}

	var regions []Region
	for ref, ws := range bySource {
		src := sources[ref]
		sort.Slice(ws, func(i, j int) bool {
			if ws[i].w.Start != ws[j].w.Start {
				return ws[i].w.Start < ws[j].w.Start
			}
			return ws[i].w.End < ws[j].w.End
		})
		start, end := ws[0].w.Start, ws[0].w.End
		best, count := ws[0].score, 1
		flush := func() {
			regions = append(regions, resolveRegion(src, start, end, best, count))
		}
		for _, r := range ws[1:] {
			if r.w.Start <= end { // overlapping or touching: same region
				if r.w.End > end {
					end = r.w.End
				}
				if r.score > best {
					best = r.score
				}
				count++
				continue
			}
			flush()
			start, end, best, count = r.w.Start, r.w.End, r.score, 1
		}
		flush()
	}
	return regions
}
```

`mergeWindows` works in two stages. The first pass deduplicates by window id
and groups the survivors per source, since spans of different sources are never
mergeable. The second runs a classic interval merge within each source: the
windows are sorted by start (end breaking ties), and a running `[start, end)`
span absorbs every window that overlaps or touches it — the `<=` in
`r.w.Start <= end` is what makes exactly-adjacent spans merge too — extending
the end, keeping the best score, and counting the coverage. A window that
starts past the current end flushes the accumulated region and opens a new one,
and the trailing `flush` emits the last. Every flush goes through
`resolveRegion`, so regions leave this function already carrying their text and
blocks. Iterating `bySource` means the output order is arbitrary here; the
ranking sort in `buildRegions` is what restores determinism.

### Resolving a region

```go
// resolveRegion slices the exact span text and its covered components out of the
// source.
func resolveRegion(src Source, start, end int, relevance float64, density int) Region {
	text := ""
	if start >= 0 && end <= len(src.Text) && start <= end {
		text = src.Text[start:end]
	}
	return Region{
		SourceType: src.SourceType, SourceID: src.SourceID,
		Start: start, End: end, Relevance: relevance, Density: density,
		Text: text, Blocks: coveredBlocks(src.Blocks, start, end),
	}
}
```

`resolveRegion` materializes a merged span into a `Region`: the exact text
sliced from the source snapshot, and the origin components the range touches
via `coveredBlocks` (from `knowledge.go`). The bounds check around the slice is
defensive in the same spirit as the rest of the package — only an in-range
`[start, end)` is sliced, so a stale or corrupt span yields an empty text
rather than a panic.

### Region text is stitched from windows, not sliced from the source

`mergeWindows` takes a `map[string]WindowContent` and assembles each region's text as
it merges, appending only the part each window adds beyond what is already covered.
`resolveRegion` is gone: there is nothing left to resolve *against*, because the text
arrives with the windows.

This is the storage correction at the point it is visible. A region used to be
produced by merging ranges and then cutting one contiguous span out of a second copy
of the whole source — so answering a query meant loading every source the top-k
happened to touch, in full. Nothing here reads a source's bytes.

The old `start >= 0 && end <= len(src.Text)` bound check went with it, and its
disappearance is the point rather than a tidy-up: it existed because a window's range
and the stored copy could disagree. They no longer can, because both halves of a
window are written from the same snapshot in the same pass.

**Two properties make the arithmetic safe**, and both are asserted rather than
assumed:

- Window starts strictly increase and ends never decrease (`windowSpans` guarantees
  it). So each window either extends the region rightward or lies entirely within it,
  and `end - r.w.Start` is always a valid offset into that window's own text. A
  *suffix* window — one ending exactly where the region already ends — contributes
  nothing but its blocks, which the offset arithmetic handles by landing on
  `len(text)`.
- A window's text is exactly its range.

A window with no content in the map yields an empty span rather than a panic or a
wrong quotation. It should not happen — the map is built from the ids that were
ranked — but a region is evidence shown to a model, so the failure mode has to be
"says nothing" rather than "says something false".

### `addBlockRefs` — union, in source order

Blocks are unioned across the merged windows rather than recomputed from the source's
block table, and the result is the same set: the merged windows cover the region
contiguously, so any block overlapping the region overlaps at least one of them.
Windows arrive in start order and each carries its blocks in source order, so
first-seen order *is* source order — which is what keeps the citation list
byte-identical to what it was.

### The differential gate

`regions_internal_test.go` keeps the old slice-from-source implementation as an
oracle and requires the stitched regions to match it byte for byte — text, range,
blocks, density and relevance — across eight merge shapes: single, overlapping pairs
and triples, reverse rank order, disjoint, mixed runs, duplicate rankings, and every
window at once.

Adjacent and disjoint cases are there because they take different branches from the
overlapping one, and a formula that only handled the interesting case would pass on
the interesting case alone. The gate was verified to fail on a one-byte offset error
before being trusted.

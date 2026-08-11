package knowledge

import (
	"math"
	"slices"
	"sort"
)

// Region is the grounded retrieval unit: a merged, verbatim, contiguous span of
// one source. Raw top-k windows overlap (adjacent windows share trailing
// sentences) and fragment context; regions repair both — retrieved windows of
// the same source that overlap or touch are merged into one span, carrying the
// best covering window's relevance and a density count of how many retrieved
// windows converged on it. Text is always an exact slice of the source
// snapshot, and Blocks names the origin components the span touches.
type Region struct {
	SourceType string `json:"sourceType"`
	SourceID   string `json:"sourceId"`
	// SourceLabel and IndexedRevision are internal provenance carried from the
	// admitted Source to the tool layer. They are not citation coordinates.
	SourceLabel     string     `json:"-"`
	IndexedRevision int64      `json:"indexedRevision"`
	GenerationID    string     `json:"generationId"`
	SourceHash      string     `json:"sourceHash"`
	WindowIDs       []string   `json:"windowIds"`
	Start           int        `json:"start"`
	End             int        `json:"end"`
	Relevance       float64    `json:"relevance"`
	Density         int        `json:"density"`
	Text            string     `json:"text"`
	Blocks          []BlockRef `json:"blocks,omitempty"`
}

// buildRegions turns ranked windows into budgeted regions: merge per source,
// rank by relevance (density, then position, breaking ties), then admit regions
// in rank order under the character budget — with a controlled overage for
// dense regions, and the top region always admitted so a result is never empty
// because the best answer was large.
func buildRegions(ranked []scoredWindow, sources map[string]Source, content map[string]WindowContent, budget int) []Region {
	if len(ranked) == 0 {
		return nil
	}
	regions := mergeWindows(ranked, sources, content)
	return admitRegions(regions, budget)
}

// buildRegionsChecked is the fail-closed evidence assembly path. Ranking reads
// vectors while hydration reads source metadata and literal window content, so
// a concurrent replacement can otherwise make three individually valid reads
// describe different snapshots. The retrieval caller supplies the read token it
// captured before ranking and rechecks it after this method returns. This method
// makes the other half of that protocol explicit: nothing malformed or missing
// is ever turned into a partial citation.
func buildRegionsChecked(
	ranked []scoredWindow,
	sources map[string]Source,
	content map[string]WindowContent,
	budget int,
	token ReadToken,
	space EmbeddingSpace,
) ([]Region, error) {
	if len(ranked) == 0 {
		return nil, nil
	}
	if err := validateEvidenceInputs(ranked, sources, content, token, space); err != nil {
		return nil, err
	}
	regions, err := mergeWindowsChecked(ranked, sources, content, token)
	if err != nil {
		return nil, err
	}
	return admitRegions(regions, budget), nil
}

func admitRegions(regions []Region, budget int) []Region {
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

// validateEvidenceInputs proves the facts mergeWindowsChecked relies on. A
// missing map entry is not an empty Source or empty window: it is corrupt
// evidence. Likewise, dot deliberately tolerates unequal vector lengths for
// clustering mechanics, but retrieval cannot compare a candidate from a
// different dimensional space and call the score meaningful.
func validateEvidenceInputs(
	ranked []scoredWindow,
	sources map[string]Source,
	content map[string]WindowContent,
	token ReadToken,
	space EmbeddingSpace,
) error {
	if token.ProjectID == "" || token.GenerationID == "" || space.Validate() != nil {
		return ErrEvidenceCorrupt
	}
	wantIdentity := space.VectorIdentity()
	checkedSources := map[string]bool{}
	for _, r := range ranked {
		w := r.w
		if w.ID == "" || w.LocalRefID == "" || len(w.Embedding) != space.Dimensions {
			return ErrEvidenceCorrupt
		}
		for _, component := range w.Embedding {
			if math.IsNaN(component) || math.IsInf(component, 0) {
				return ErrEvidenceCorrupt
			}
		}
		src, ok := sources[w.LocalRefID]
		if !ok || src.LocalRefID != w.LocalRefID || src.ProjectID != token.ProjectID ||
			src.SourceType == "" || src.SourceID == "" || src.Identity != wantIdentity ||
			src.SizeBytes < 0 || src.ContentHash == "" {
			return ErrEvidenceCorrupt
		}
		if !checkedSources[w.LocalRefID] {
			if !validBlockSpans(src.Blocks, src.SizeBytes) {
				return ErrEvidenceCorrupt
			}
			checkedSources[w.LocalRefID] = true
		}
		c, ok := content[w.ID]
		if !ok || w.Start < 0 || w.End < w.Start || w.End > src.SizeBytes ||
			len(c.Text) != w.End-w.Start ||
			!slices.Equal(c.Blocks, coveredBlocks(src.Blocks, w.Start, w.End)) {
			return ErrEvidenceCorrupt
		}
	}
	return nil
}

func validBlockSpans(blocks []BlockSpan, sourceBytes int) bool {
	previousEnd := 0
	for _, block := range blocks {
		if block.Start < previousEnd || block.Start < 0 || block.End <= block.Start || block.End > sourceBytes {
			return false
		}
		previousEnd = block.End
	}
	return true
}

// mergeWindows deduplicates the ranked windows and merges, per source, every
// overlapping or touching span into one region — stitching the region's text out of
// the windows' own text as it goes. Relevance is the best covering window's score;
// density counts the covering windows.
//
// The text is assembled rather than sliced, and that is the storage correction: a
// region used to be produced by merging ranges and then cutting one contiguous span
// out of a second copy of the whole source. Nothing here loads the source's bytes.
//
// Two properties make the arithmetic safe, and both are asserted rather than assumed
// (see regions_internal_test.go and TestWindowsStitchBackIntoTheSource):
//
//   - Window starts strictly increase and ends never decrease, which windowSpans
//     guarantees. So each window either extends the region to the right or lies
//     entirely inside it, and `end - r.w.Start` is always a valid offset into the
//     window's own text.
//   - A window's text is exactly its range, because both are written from the same
//     snapshot in the same pass and the reuse path never inherits a range.
func mergeWindows(ranked []scoredWindow, sources map[string]Source, content map[string]WindowContent) []Region {
	regions, _ := mergeWindowsInternal(ranked, sources, content, ReadToken{}, false)
	return regions
}

func mergeWindowsChecked(
	ranked []scoredWindow,
	sources map[string]Source,
	content map[string]WindowContent,
	token ReadToken,
) ([]Region, error) {
	return mergeWindowsInternal(ranked, sources, content, token, true)
}

func mergeWindowsInternal(
	ranked []scoredWindow,
	sources map[string]Source,
	content map[string]WindowContent,
	token ReadToken,
	checked bool,
) ([]Region, error) {
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
		text := content[ws[0].w.ID].Text
		blocks := append([]BlockRef(nil), content[ws[0].w.ID].Blocks...)
		windowIDs := []string{ws[0].w.ID}
		flush := func() error {
			if checked && len(text) != end-start {
				return ErrEvidenceCorrupt
			}
			regions = append(regions, Region{
				SourceType: src.SourceType, SourceID: src.SourceID,
				SourceLabel: src.Label, IndexedRevision: src.Revision,
				GenerationID: token.GenerationID, SourceHash: src.ContentHash,
				WindowIDs: append([]string(nil), windowIDs...),
				Start:     start, End: end, Relevance: best, Density: count,
				Text: text, Blocks: blocks,
			})
			return nil
		}
		for _, r := range ws[1:] {
			if r.w.Start <= end { // overlapping or touching: same region
				c := content[r.w.ID]
				if r.w.End > end {
					// Append only the part this window adds beyond what is already
					// covered. A window that ends where the region already ends — a
					// suffix window — contributes nothing but its blocks.
					off := end - r.w.Start
					if checked {
						if off < 0 || off > len(c.Text) || off > len(text) ||
							text[len(text)-off:] != c.Text[:off] {
							return nil, ErrEvidenceCorrupt
						}
					}
					if off >= 0 && off <= len(c.Text) {
						text += c.Text[off:]
					}
					end = r.w.End
				} else if checked {
					// A fully contained window contributes no new bytes, but the
					// bytes it claims must still be the same literal snapshot.
					off := r.w.Start - start
					if off < 0 || off+len(c.Text) > len(text) ||
						text[off:off+len(c.Text)] != c.Text {
						return nil, ErrEvidenceCorrupt
					}
				}
				blocks = addBlockRefs(blocks, c.Blocks)
				windowIDs = append(windowIDs, r.w.ID)
				if r.score > best {
					best = r.score
				}
				count++
				continue
			}
			if err := flush(); err != nil {
				return nil, err
			}
			start, end, best, count = r.w.Start, r.w.End, r.score, 1
			text = content[r.w.ID].Text
			blocks = append([]BlockRef(nil), content[r.w.ID].Blocks...)
			windowIDs = []string{r.w.ID}
		}
		if err := flush(); err != nil {
			return nil, err
		}
	}
	return regions, nil
}

// addBlockRefs appends the refs not already present, preserving first-seen order.
//
// Union over the merged windows is the same set slicing the source's block table
// would produce: the merged windows cover the region contiguously, so any block
// overlapping the region overlaps at least one of them. Because windows arrive in
// start order and each carries its blocks in source order, first-seen order *is*
// source order — which is what keeps the citation list identical to what it was.
func addBlockRefs(into, add []BlockRef) []BlockRef {
	for _, b := range add {
		if !slices.Contains(into, b) {
			into = append(into, b)
		}
	}
	return into
}

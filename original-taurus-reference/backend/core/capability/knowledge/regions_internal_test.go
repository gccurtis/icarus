package knowledge

import (
	"errors"
	"math"
	"slices"
	"strings"
	"testing"
)

var regionTestIdentity = VectorIdentity{Provider: "test", Model: "embed", Dims: 2}

func regionTestSpace() EmbeddingSpace { return SpaceForIdentity(regionTestIdentity) }

func regionTestToken() ReadToken {
	return ReadToken{
		ProjectID: "project-one", Kind: LatticeText, GenerationID: "generation-one",
		StateRevision: 1, SourceCursor: 1,
	}
}

// regionFixture is a source, its windows, and the content map the store would
// return for them — built the way ingest builds them, so the spans and texts are
// consistent by construction rather than by hand.
type regionFixture struct {
	src     Source
	windows []Window
	content map[string]WindowContent
	// text is the source snapshot the oracle slices. It lives on the fixture rather
	// than on Source because a Source no longer keeps its text — which is exactly
	// the change this file gates.
	text string
}

func newRegionFixture(t *testing.T, text string, blocks []BlockSpan, target, overlap int) regionFixture {
	t.Helper()
	spans := windowSpans(text, target, overlap)
	if len(spans) < 3 {
		t.Fatalf("fixture needs several windows to exercise merging, got %d", len(spans))
	}
	f := regionFixture{
		src: Source{
			SourceType: SourceTypeDocument, SourceID: "doc1", LocalRefID: "ref1",
			ProjectID: "project-one", SizeBytes: len(text), ContentHash: "source-hash",
			Identity: regionTestIdentity, Revision: 7, Blocks: blocks,
		},
		text:    text,
		content: map[string]WindowContent{},
	}
	for i, s := range spans {
		id := "w" + string(rune('A'+i))
		f.windows = append(f.windows, Window{
			ID: id, LocalRefID: "ref1", Ordinal: s.ordinal, Start: s.start, End: s.end,
			Text: text[s.start:s.end], Blocks: coveredBlocks(blocks, s.start, s.end),
			Embedding: []float64{1, 0},
		})
		f.content[id] = WindowContent{Text: text[s.start:s.end], Blocks: coveredBlocks(blocks, s.start, s.end)}
	}
	return f
}

// ranked builds a scored window list from the fixture's windows at the given
// indices, highest score first.
func (f regionFixture) ranked(idx ...int) []scoredWindow {
	var out []scoredWindow
	for i, n := range idx {
		out = append(out, scoredWindow{w: f.windows[n], score: 1 - float64(i)/100})
	}
	return out
}

// sliceRegions is the OLD implementation, kept as the differential oracle: merge
// ranges, then slice the one contiguous span out of the source's stored text.
//
// It is what every region in production looked like before windows carried their own
// text, so agreeing with it byte for byte is the definition of "this change did not
// alter what gets cited".
func sliceRegions(ranked []scoredWindow, src Source, srcText string) []Region {
	seen := map[string]bool{}
	var ws []scoredWindow
	for _, r := range ranked {
		if seen[r.w.ID] {
			continue
		}
		seen[r.w.ID] = true
		ws = append(ws, r)
	}
	sortScored(ws)
	var out []Region
	start, end := ws[0].w.Start, ws[0].w.End
	best, count := ws[0].score, 1
	flush := func() {
		text := ""
		if start >= 0 && end <= len(srcText) && start <= end {
			text = srcText[start:end]
		}
		out = append(out, Region{
			SourceType: src.SourceType, SourceID: src.SourceID,
			Start: start, End: end, Relevance: best, Density: count,
			Text: text, Blocks: coveredBlocks(src.Blocks, start, end),
		})
	}
	for _, r := range ws[1:] {
		if r.w.Start <= end {
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
	return out
}

func sortScored(ws []scoredWindow) {
	for i := 1; i < len(ws); i++ {
		for j := i; j > 0; j-- {
			a, b := ws[j-1].w, ws[j].w
			if a.Start < b.Start || (a.Start == b.Start && a.End <= b.End) {
				break
			}
			ws[j-1], ws[j] = ws[j], ws[j-1]
		}
	}
}

// The differential gate for the storage correction: regions stitched from window
// text must be byte-identical to regions sliced from the source's stored copy, with
// the same blocks, across every merge shape.
//
// Overlapping is the case that exercises the stitch arithmetic. Adjacent and disjoint
// are here because they take different branches — the first merges with zero overlap
// to skip, the second flushes and starts a new region — and a formula that only
// handled the interesting case would pass on the interesting case alone.
func TestStitchedRegionsMatchSlicedRegions(t *testing.T) {
	text := strings.Repeat("alpha beta gamma delta. epsilon zeta eta theta. iota kappa lambda mu. ", 12)
	third := len(text) / 3
	blocks := []BlockSpan{
		{RowID: "r1", BlockID: "b1", Start: 0, End: third},
		{RowID: "r2", BlockID: "b2", Start: third, End: 2 * third},
		{RowID: "r3", BlockID: "b3", Start: 2 * third, End: len(text)},
	}
	f := newRegionFixture(t, text, blocks, 200, 40)

	cases := []struct {
		name string
		idx  []int
	}{
		{"single window", []int{0}},
		{"two overlapping", []int{0, 1}},
		{"three overlapping", []int{0, 1, 2}},
		{"overlapping, reverse rank order", []int{2, 1, 0}},
		{"disjoint pair", []int{0, len(f.windows) - 1}},
		{"a run and a distant one", []int{0, 1, len(f.windows) - 1}},
		{"duplicates in the ranking", []int{1, 1, 0}},
		{"every window", func() []int {
			all := make([]int, len(f.windows))
			for i := range all {
				all[i] = i
			}
			return all
		}()},
	}

	for _, tc := range cases {
		ranked := f.ranked(tc.idx...)
		sources := map[string]Source{"ref1": f.src}

		got := mergeWindows(ranked, sources, f.content)
		want := sliceRegions(ranked, f.src, f.text)

		if len(got) != len(want) {
			t.Errorf("%s: %d regions, want %d", tc.name, len(got), len(want))
			continue
		}
		sortRegions(got)
		sortRegions(want)
		for i := range want {
			g, w := got[i], want[i]
			if g.Start != w.Start || g.End != w.End {
				t.Errorf("%s region %d: range [%d,%d], want [%d,%d]", tc.name, i, g.Start, g.End, w.Start, w.End)
			}
			if g.Text != w.Text {
				t.Errorf("%s region %d [%d,%d]: text differs\n got %d bytes: %q\nwant %d bytes: %q",
					tc.name, i, g.Start, g.End, len(g.Text), truncate(g.Text), len(w.Text), truncate(w.Text))
			}
			if g.Density != w.Density || g.Relevance != w.Relevance {
				t.Errorf("%s region %d: density/relevance = %d/%v, want %d/%v",
					tc.name, i, g.Density, g.Relevance, w.Density, w.Relevance)
			}
			if len(g.Blocks) != len(w.Blocks) {
				t.Errorf("%s region %d: %d blocks, want %d (%+v vs %+v)",
					tc.name, i, len(g.Blocks), len(w.Blocks), g.Blocks, w.Blocks)
				continue
			}
			for j := range w.Blocks {
				if g.Blocks[j] != w.Blocks[j] {
					t.Errorf("%s region %d block %d = %+v, want %+v", tc.name, i, j, g.Blocks[j], w.Blocks[j])
				}
			}
		}
	}
}

// A region's text is always exactly its own byte range — the property a citation
// rests on, checked independently of the oracle in case both agreed on a wrong
// answer.
func TestStitchedRegionTextMatchesItsRange(t *testing.T) {
	text := strings.Repeat("one two three four. five six seven eight. ", 15)
	f := newRegionFixture(t, text, nil, 200, 40)
	all := make([]int, len(f.windows))
	for i := range all {
		all[i] = i
	}

	for _, r := range mergeWindows(f.ranked(all...), map[string]Source{"ref1": f.src}, f.content) {
		if r.Text != text[r.Start:r.End] {
			t.Errorf("region [%d,%d]: text is not its range\n got: %q\nwant: %q",
				r.Start, r.End, truncate(r.Text), truncate(text[r.Start:r.End]))
		}
	}
}

// A missing content row is corruption, never an empty quotation. Empty evidence
// used to look harmless but could be passed to synthesis as a real citation.
func TestCheckedRegionsRejectMissingContent(t *testing.T) {
	text := strings.Repeat("one two three four. five six seven eight. ", 15)
	f := newRegionFixture(t, text, nil, 200, 40)

	regions, err := buildRegionsChecked(
		f.ranked(0, 1), map[string]Source{"ref1": f.src}, map[string]WindowContent{},
		4000, regionTestToken(), regionTestSpace(),
	)
	if !errors.Is(err, ErrEvidenceCorrupt) || len(regions) != 0 {
		t.Fatalf("regions = %+v, err = %v; want no evidence and ErrEvidenceCorrupt", regions, err)
	}
}

func TestCheckedRegionsCarryImmutableProvenance(t *testing.T) {
	text := strings.Repeat("one two three four. five six seven eight. ", 15)
	f := newRegionFixture(t, text, nil, 200, 40)
	ranked := f.ranked(0, 1)

	regions, err := buildRegionsChecked(
		ranked, map[string]Source{"ref1": f.src}, f.content,
		4000, regionTestToken(), regionTestSpace(),
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(regions) != 1 {
		t.Fatalf("regions = %d, want 1", len(regions))
	}
	got := regions[0]
	if got.GenerationID != "generation-one" || got.SourceHash != "source-hash" || got.IndexedRevision != 7 {
		t.Fatalf("provenance = generation %q, hash %q, revision %d",
			got.GenerationID, got.SourceHash, got.IndexedRevision)
	}
	wantIDs := []string{ranked[0].w.ID, ranked[1].w.ID}
	if !slices.Equal(got.WindowIDs, wantIDs) {
		t.Fatalf("window ids = %v, want %v", got.WindowIDs, wantIDs)
	}
}

func TestCheckedRegionsRejectCorruptEvidence(t *testing.T) {
	text := strings.Repeat("one two three four. five six seven eight. ", 15)

	tests := []struct {
		name   string
		mutate func([]scoredWindow, map[string]Source, map[string]WindowContent)
	}{
		{
			name: "missing source",
			mutate: func(_ []scoredWindow, sources map[string]Source, _ map[string]WindowContent) {
				delete(sources, "ref1")
			},
		},
		{
			name: "wrong project",
			mutate: func(_ []scoredWindow, sources map[string]Source, _ map[string]WindowContent) {
				src := sources["ref1"]
				src.ProjectID = "project-two"
				sources["ref1"] = src
			},
		},
		{
			name: "missing source hash",
			mutate: func(_ []scoredWindow, sources map[string]Source, _ map[string]WindowContent) {
				src := sources["ref1"]
				src.ContentHash = ""
				sources["ref1"] = src
			},
		},
		{
			name: "wrong embedding identity",
			mutate: func(_ []scoredWindow, sources map[string]Source, _ map[string]WindowContent) {
				src := sources["ref1"]
				src.Identity.Model = "other"
				sources["ref1"] = src
			},
		},
		{
			name: "wrong vector dimensions",
			mutate: func(ranked []scoredWindow, _ map[string]Source, _ map[string]WindowContent) {
				ranked[0].w.Embedding = []float64{1}
			},
		},
		{
			name: "non-finite vector",
			mutate: func(ranked []scoredWindow, _ map[string]Source, _ map[string]WindowContent) {
				ranked[0].w.Embedding = []float64{math.NaN(), 0}
			},
		},
		{
			name: "range outside source",
			mutate: func(ranked []scoredWindow, _ map[string]Source, _ map[string]WindowContent) {
				ranked[0].w.Start = -1
			},
		},
		{
			name: "text length differs from range",
			mutate: func(ranked []scoredWindow, _ map[string]Source, content map[string]WindowContent) {
				c := content[ranked[0].w.ID]
				c.Text = c.Text[:len(c.Text)-1]
				content[ranked[0].w.ID] = c
			},
		},
		{
			name: "invalid source block span",
			mutate: func(_ []scoredWindow, sources map[string]Source, _ map[string]WindowContent) {
				src := sources["ref1"]
				src.Blocks = []BlockSpan{{Start: 0, End: src.SizeBytes + 1}}
				sources["ref1"] = src
			},
		},
		{
			name: "window block refs differ from source",
			mutate: func(ranked []scoredWindow, _ map[string]Source, content map[string]WindowContent) {
				c := content[ranked[0].w.ID]
				c.Blocks = []BlockRef{{RowID: "wrong", BlockID: "wrong"}}
				content[ranked[0].w.ID] = c
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			f := newRegionFixture(t, text, nil, 200, 40)
			ranked := f.ranked(0, 1)
			sources := map[string]Source{"ref1": f.src}
			content := make(map[string]WindowContent, len(f.content))
			for id, c := range f.content {
				content[id] = c
			}
			tc.mutate(ranked, sources, content)

			regions, err := buildRegionsChecked(
				ranked, sources, content, 4000, regionTestToken(), regionTestSpace(),
			)
			if !errors.Is(err, ErrEvidenceCorrupt) || len(regions) != 0 {
				t.Fatalf("regions = %+v, err = %v; want no evidence and ErrEvidenceCorrupt", regions, err)
			}
		})
	}
}

func TestCheckedRegionsRejectInconsistentOverlap(t *testing.T) {
	text := strings.Repeat("one two three four. five six seven eight. ", 15)
	f := newRegionFixture(t, text, nil, 200, 40)
	ranked := f.ranked(0, 1)
	second := ranked[1].w
	c := f.content[second.ID]
	c.Text = strings.Repeat("x", len(c.Text))
	f.content[second.ID] = c

	regions, err := buildRegionsChecked(
		ranked, map[string]Source{"ref1": f.src}, f.content,
		4000, regionTestToken(), regionTestSpace(),
	)
	if !errors.Is(err, ErrEvidenceCorrupt) || len(regions) != 0 {
		t.Fatalf("regions = %+v, err = %v; want no evidence and ErrEvidenceCorrupt", regions, err)
	}
}

func sortRegions(rs []Region) {
	for i := 1; i < len(rs); i++ {
		for j := i; j > 0 && rs[j-1].Start > rs[j].Start; j-- {
			rs[j-1], rs[j] = rs[j], rs[j-1]
		}
	}
}

func truncate(s string) string {
	if len(s) <= 60 {
		return s
	}
	return s[:30] + "…" + s[len(s)-30:]
}

package knowledge_test

import (
	"context"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// addWindowed admits one source and returns its stored windows.
func addWindowed(t *testing.T, text string, blocks []knowledge.BlockSpan) (*knowledge.MemoryStore, []knowledge.Window) {
	t.Helper()
	store := knowledge.NewMemoryStore()
	k := knowledge.New(store, fakeEmbedder{dim: 64}, smallWindows)
	if _, err := k.Add(context.Background(), "p", knowledge.SourceTypeDocument, "doc1", "", text, blocks, 0); err != nil {
		t.Fatalf("add: %v", err)
	}
	src, ok, err := store.SourceByOrigin("p", knowledge.SourceTypeDocument, "doc1")
	if err != nil || !ok {
		t.Fatalf("source not stored: ok=%v err=%v", ok, err)
	}
	windows, err := store.SourceWindows(src.LocalRefID)
	if err != nil {
		t.Fatalf("windows: %v", err)
	}
	if len(windows) < 2 {
		t.Fatalf("want several windows to exercise the invariant, got %d", len(windows))
	}
	return store, windows
}

// A window's text is EXACTLY the range it records.
//
// This equality is what the whole storage correction rests on. A citation has to be
// interpretable from the artifact alone, and the two halves can never drift apart
// because both are computed from the same snapshot in the same pass — the reuse path
// inherits ids and vectors, never ranges. If this ever fails, some path has started
// writing a window's text and its range from different sources of truth.
func TestWindowTextIsExactlyItsRange(t *testing.T) {
	text := strings.Repeat("alpha beta gamma delta. epsilon zeta eta theta. ", 30)
	_, windows := addWindowed(t, text, nil)

	for _, w := range windows {
		if w.Start < 0 || w.End > len(text) || w.Start > w.End {
			t.Fatalf("window %d has a range outside the source: [%d,%d] of %d", w.Ordinal, w.Start, w.End, len(text))
		}
		if w.Text != text[w.Start:w.End] {
			t.Errorf("window at [%d,%d]: text is not its range\n got: %q\nwant: %q",
				w.Start, w.End, w.Text, text[w.Start:w.End])
		}
	}
}

// A window carries the origin components its text covers, and they are the same set
// the byte range resolves to. Denormalizing them onto the window is what lets a
// region be cited without loading the source's block table.
func TestWindowCarriesItsCoveredBlocks(t *testing.T) {
	text := strings.Repeat("alpha beta gamma delta. epsilon zeta eta theta. ", 30)
	half := len(text) / 2
	blocks := []knowledge.BlockSpan{
		{RowID: "r1", BlockID: "b1", Start: 0, End: half},
		{RowID: "r2", BlockID: "b2", Start: half, End: len(text)},
	}
	_, windows := addWindowed(t, text, blocks)

	for _, w := range windows {
		want := knowledge.CoveredBlocks(blocks, w.Start, w.End)
		if len(w.Blocks) != len(want) {
			t.Fatalf("window [%d,%d]: %d blocks, want %d", w.Start, w.End, len(w.Blocks), len(want))
		}
		for i := range want {
			if w.Blocks[i] != want[i] {
				t.Errorf("window [%d,%d] block %d = %+v, want %+v", w.Start, w.End, i, w.Blocks[i], want[i])
			}
		}
		if len(w.Blocks) == 0 {
			t.Errorf("window [%d,%d] covers no block, but the blocks tile the source", w.Start, w.End)
		}
	}
}

// WindowContent returns what a region is assembled from, for the windows asked about
// and no others — it is the narrow read that replaced loading whole sources.
func TestWindowContentReturnsOnlyWhatWasAsked(t *testing.T) {
	text := strings.Repeat("alpha beta gamma delta. epsilon zeta eta theta. ", 30)
	store, windows := addWindowed(t, text, nil)

	ids := []string{windows[0].ID, windows[1].ID}
	content, err := store.WindowContent(ids)
	if err != nil {
		t.Fatalf("WindowContent: %v", err)
	}
	if len(content) != 2 {
		t.Fatalf("got %d entries for 2 ids: %v", len(content), content)
	}
	for _, w := range windows[:2] {
		got, ok := content[w.ID]
		if !ok {
			t.Fatalf("no content for window %s", w.ID)
		}
		if got.Text != w.Text {
			t.Errorf("content text for %s = %q, want %q", w.ID, got.Text, w.Text)
		}
	}
	// An unknown id is skipped rather than erroring, matching every other by-id
	// batch read in the store.
	content, err = store.WindowContent([]string{"nope"})
	if err != nil {
		t.Fatalf("WindowContent with an unknown id: %v", err)
	}
	if len(content) != 0 {
		t.Errorf("unknown id produced %v", content)
	}
}

// Concatenating a source's windows in order, skipping each one's overlap with what
// came before, reproduces the source byte for byte.
//
// This is the property region stitching depends on, proven at the source level: it
// says the windows tile the text with no gap and no duplication once overlap is
// accounted for. It is also what makes the merge formula's arithmetic safe — every
// window's contribution starts exactly where the previous one ended.
func TestWindowsStitchBackIntoTheSource(t *testing.T) {
	text := strings.Repeat("alpha beta gamma delta. epsilon zeta eta theta. ", 30)
	_, windows := addWindowed(t, text, nil)

	var out strings.Builder
	end := 0
	for _, w := range windows {
		if w.Start > end {
			t.Fatalf("gap in coverage: window starts at %d, previous ended at %d", w.Start, end)
		}
		if w.End <= end {
			continue // fully covered already
		}
		out.WriteString(w.Text[end-w.Start:])
		end = w.End
	}
	if out.String() != text {
		t.Errorf("stitched windows do not reproduce the source (%d bytes vs %d)", out.Len(), len(text))
	}
}

package document_test

import (
	"reflect"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

func TestCreateCapturesLayoutDefaults(t *testing.T) {
	store := document.NewMemoryStore()
	page := document.PageLayout{
		Width: 500, Height: 700,
		MarginTop: 50, MarginRight: 40, MarginBottom: 50, MarginLeft: 40,
	}
	rules := document.LayoutRules{
		MaxFontHeight: 20, MinRowPadding: 3, CharWidth: 10,
	}
	first := document.New(store, document.Options{PageLayout: page, LayoutRules: rules})
	doc, err := first.Create("p", "Doc", document.Base{Rows: []document.Row{{
		ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText}},
	}}})
	if err != nil {
		t.Fatal(err)
	}
	if doc.Base.PageLayout != page || doc.Base.LayoutRules != rules {
		t.Fatalf("captured layout = %+v / %+v", doc.Base.PageLayout, doc.Base.LayoutRules)
	}
	style := doc.Base.Rows[0].Blocks[0].Style
	if style.HorizontalAlign != document.HorizontalAlignLeft ||
		style.VerticalAlign != document.VerticalAlignTop {
		t.Fatalf("default block style = %+v", style)
	}

	// A service restarted under different defaults preserves the effective
	// metrics already captured by this document.
	second := document.New(store, document.Options{
		LayoutRules: document.LayoutRules{
			MaxFontHeight: 30, MinRowPadding: 6, CharWidth: 12,
		},
	})
	got, err := second.Get("p", doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Base.PageLayout != page || got.Base.LayoutRules != rules {
		t.Fatalf("layout drifted after restart = %+v / %+v", got.Base.PageLayout, got.Base.LayoutRules)
	}
}

func TestPaginateUsesVariableRowHeights(t *testing.T) {
	tall := document.LayoutUnit(14)
	base := document.Base{
		PageLayout: document.PageLayout{
			Width: 100, Height: 50,
			MarginTop: 10, MarginRight: 10, MarginBottom: 10, MarginLeft: 10,
		},
		LayoutRules: document.LayoutRules{
			MaxFontHeight: 10, MinRowPadding: 2, CharWidth: 6,
		},
		Rows: []document.Row{
			{ID: "r1"},
			{ID: "r2", Blocks: []document.Block{{ID: "b2", Style: document.BlockStyle{LineHeight: tall}}}},
			{ID: "r3"},
		},
	}
	pages, err := document.Paginate(base)
	if err != nil {
		t.Fatal(err)
	}
	// r1: 10 + 4 = 14, r2: 14 + 4 = 18, r3: 10 + 4 = 14
	// usable = 50 - 10 - 10 = 30. Page 1: r1+r2 = 32 -> only r1 fits (14)
	// Page 2: r2 (18) + r3 (14) = 32 -> only r2 fits (18)
	// Page 3: r3 (14)
	want := []document.Page{
		{Number: 1, RowIDs: []string{"r1"}, UsedHeight: 14},
		{Number: 2, RowIDs: []string{"r2"}, UsedHeight: 18},
		{Number: 3, RowIDs: []string{"r3"}, UsedHeight: 14},
	}
	if !reflect.DeepEqual(pages, want) {
		t.Fatalf("pages = %+v, want %+v", pages, want)
	}

	base.Rows = nil
	pages, err = document.Paginate(base)
	if err != nil || len(pages) != 1 || pages[0].Number != 1 || len(pages[0].RowIDs) != 0 {
		t.Fatalf("empty pages = %+v, %v", pages, err)
	}
}

func TestPaginateWrapsTextWithCharWidth(t *testing.T) {
	base := document.Base{
		PageLayout: document.PageLayout{
			Width: 200, Height: 200,
			MarginTop: 10, MarginRight: 10, MarginBottom: 10, MarginLeft: 10,
		},
		LayoutRules: document.LayoutRules{
			MaxFontHeight: 12, MinRowPadding: 2, CharWidth: 5,
		},
		Rows: []document.Row{
			{ID: "r1", Blocks: []document.Block{
				{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "1234567890123456789012345678901234567890"}}},
			}},
			{ID: "r2", Blocks: []document.Block{
				{ID: "b2", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "short"}}},
			}},
		},
	}
	pages, err := document.Paginate(base)
	if err != nil {
		t.Fatal(err)
	}
	// contentWidth = 200 - 10 - 10 = 180, charsPerLine = 180/5 = 36
	// r1: 40 chars / 36 = 2 lines -> 2*12 + 4 = 28
	// r2: 5 chars / 36 = 1 line -> 1*12 + 4 = 16
	// usable = 200 - 10 - 10 = 180. Both fit: 28 + 16 = 44.
	if len(pages) != 1 || len(pages[0].RowIDs) != 2 {
		t.Fatalf("wrapping pages = %+v, want 1 page with 2 rows", pages)
	}
	if pages[0].UsedHeight != 44 {
		t.Fatalf("wrapping used height = %d, want 44 (28+16)", pages[0].UsedHeight)
	}
}

func TestPaginateWrapsTrackedBlocks(t *testing.T) {
	base := document.Base{
		PageLayout: document.PageLayout{
			Width: 300, Height: 200,
			MarginTop: 10, MarginRight: 10, MarginBottom: 10, MarginLeft: 10,
		},
		LayoutRules: document.LayoutRules{
			MaxFontHeight: 12, MinRowPadding: 2, CharWidth: 6,
		},
		Rows: []document.Row{
			{ID: "r1", Tracks: []document.Track{
				{BlockID: "b1", Weight: 1, Gap: 0, MinWidth: 0},
				{BlockID: "b2", Weight: 3, Gap: 0, MinWidth: 0},
			}, Blocks: []document.Block{
				{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "123456789012345678901234567890"}}},
				{ID: "b2", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "hello"}}},
			}},
		},
	}
	pages, err := document.Paginate(base)
	if err != nil {
		t.Fatal(err)
	}
	// contentWidth = 300 - 20 = 280, totalWeight = 4
	// b1 width = 280 * 1/4 = 70, charsPerLine = 70/6 = 11, 30 chars / 11 = 3 lines -> 3*12 = 36
	// b2 width = 280 * 3/4 = 210, charsPerLine = 210/6 = 35, 5 chars = 1 line -> 12
	// row height = max(36, 12) + 4 = 40
	if pages[0].UsedHeight != 40 {
		t.Fatalf("tracked wrapping height = %d, want 40", pages[0].UsedHeight)
	}
}

func TestPaginateHeaderFooterConsumesSpace(t *testing.T) {
	base := document.Base{
		PageLayout: document.PageLayout{
			Width: 612, Height: 100,
			MarginTop: 10, MarginRight: 10, MarginBottom: 10, MarginLeft: 10,
		},
		LayoutRules: document.LayoutRules{
			MaxFontHeight: 12, MinRowPadding: 2, CharWidth: 8,
		},
		Header: []document.Row{
			{ID: "h1", Blocks: []document.Block{{ID: "hb1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "ha1", Kind: document.AtomKindText, Text: "H"}}}}},
		},
		Footer: []document.Row{
			{ID: "f1", Blocks: []document.Block{{ID: "fb1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "fa1", Kind: document.AtomKindText, Text: "F"}}}}},
		},
		Rows: []document.Row{
			{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "body"}}}}},
			{ID: "r2", Blocks: []document.Block{{ID: "b2", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "overflow"}}}}},
		},
	}
	pages, err := document.Paginate(base)
	if err != nil {
		t.Fatal(err)
	}
	// Each row: 12 + 4 = 16. Header: 16. Footer: 16. Total extra: 32.
	// usable = 100 - 20 = 80. contentHeight = 80 - 32 = 48.
	// r1 (16) fits on page 1. r2 (16) fits on page 1 too (32 total). Both on one page.
	if len(pages) != 1 || len(pages[0].RowIDs) != 2 {
		t.Fatalf("header/footer pages = %+v, want 1 page with 2 rows", pages)
	}
}

func TestPaginateKeepWithNext(t *testing.T) {
	base := document.Base{
		PageLayout: document.PageLayout{
			Width: 612, Height: 60,
			MarginTop: 8, MarginRight: 8, MarginBottom: 8, MarginLeft: 8,
		},
		LayoutRules: document.LayoutRules{
			MaxFontHeight: 12, MinRowPadding: 2, CharWidth: 8,
		},
		Rows: []document.Row{
			{ID: "heading", Style: document.RowStyle{KeepWithNext: true}, Blocks: []document.Block{
				{ID: "h1", Kind: document.BlockKindText, SubKind: document.SubKindHeading1, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "Heading"}}},
			}},
			{ID: "content", Blocks: []document.Block{
				{ID: "c1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "Body"}}},
			}},
		},
	}
	pages, err := document.Paginate(base)
	if err != nil {
		t.Fatal(err)
	}
	// usable = 60 - 16 = 44. Each row = 12 + 4 = 16. Heading + content = 32, fits on one page.
	// Both stay together.
	if len(pages) != 1 || len(pages[0].RowIDs) != 2 {
		t.Fatalf("keep-with-next pages = %+v, want 1 page with both rows", pages)
	}

	// Now make the page shorter so content doesn't fit with heading. KeepWithNext
	// on heading should pull heading to the new page with content.
	base.PageLayout.Height = 50 // usable = 50 - 16 = 34. Heading (16) + Content (16) = 32. Still fits.
	// Actually still fits. Let me make it tighter.
	base.PageLayout.Height = 45 // usable = 45 - 16 = 29. Heading (16) fits. Content (16) doesn't. KeepWithNext pulls heading too. Both go to page 2.
	pages, err = document.Paginate(base)
	if err != nil {
		t.Fatal(err)
	}
	if len(pages) != 1 {
		t.Fatalf("keep-with-next tight pages = %+v, want 1 page (both moved)", pages)
	}
}

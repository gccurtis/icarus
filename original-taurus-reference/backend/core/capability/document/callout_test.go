package document_test

import (
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

// A callout is a first-class text-bearing block kind: it persists, carries no
// sub-kind, and exports to Markdown as a blockquote.
func TestCalloutBlock(t *testing.T) {
	d := newDocs()
	base := document.Base{Rows: []document.Row{
		{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText,
			Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "intro"}}}}},
		{ID: "r2", Blocks: []document.Block{{ID: "c1", Kind: document.BlockKindCallout,
			Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "heads up"}}}}},
	}}
	doc, err := d.Create("p", "Doc", base)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	callout := doc.Base.Rows[1].Blocks[0]
	if callout.Kind != document.BlockKindCallout || callout.SubKind != "" {
		t.Fatalf("callout block = %+v", callout)
	}
	if callout.DisplayText() != "heads up" {
		t.Fatalf("callout text = %q", callout.DisplayText())
	}

	// A body text block can be converted to a callout via set_block.
	if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetBlock, BlockID: "b1", SetKind: strp(document.BlockKindCallout)},
	}); err != nil {
		t.Fatalf("convert to callout: %v", err)
	}
	if got, _ := d.Get("p", doc.ID); got.Base.Rows[0].Blocks[0].Kind != document.BlockKindCallout {
		t.Fatalf("kind after convert = %q", got.Base.Rows[0].Blocks[0].Kind)
	}

	// Export renders callouts as blockquotes.
	_, md, err := d.ExportMarkdown("p", doc.ID)
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	if !strings.Contains(md, "> heads up") {
		t.Errorf("callout not exported as a blockquote: %q", md)
	}
}

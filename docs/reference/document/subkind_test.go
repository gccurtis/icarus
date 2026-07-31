package document_test

import (
	"errors"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

// A text block converts between built-in sub-kinds in place via set_block_subkind,
// and a blank sub-kind is defaulted back to body.
func TestSetBlockSubkindBuiltins(t *testing.T) {
	d := newDocs()
	doc, err := d.Create("p", "Doc", oneAtomDoc("hello"))
	if err != nil {
		t.Fatal(err)
	}
	if got, _ := d.Get("p", doc.ID); got.Base.Rows[0].Blocks[0].SubKind != document.SubKindBody {
		t.Fatalf("default subKind = %q, want body", got.Base.Rows[0].Blocks[0].SubKind)
	}

	if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetBlockSubkind, BlockID: "b1", SetSubKind: strp(document.SubKindHeading3)},
	}); err != nil {
		t.Fatalf("set heading_3: %v", err)
	}
	if got, _ := d.Get("p", doc.ID); got.Base.Rows[0].Blocks[0].SubKind != document.SubKindHeading3 {
		t.Fatalf("subKind = %q, want heading_3", got.Base.Rows[0].Blocks[0].SubKind)
	}

	// A blank sub-kind resets to body.
	if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetBlockSubkind, BlockID: "b1", SetSubKind: strp("")},
	}); err != nil {
		t.Fatalf("reset: %v", err)
	}
	if got, _ := d.Get("p", doc.ID); got.Base.Rows[0].Blocks[0].SubKind != document.SubKindBody {
		t.Fatalf("subKind after reset = %q, want body", got.Base.Rows[0].Blocks[0].SubKind)
	}
}

// An unknown sub-kind that is not a built-in and not a registered style
// definition is rejected as a conflict.
func TestSetBlockSubkindUnknownRejected(t *testing.T) {
	d := newDocs()
	doc, _ := d.Create("p", "Doc", oneAtomDoc("hello"))
	_, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetBlockSubkind, BlockID: "b1", SetSubKind: strp("not-a-style")},
	})
	if !errors.Is(err, document.ErrConflict) {
		t.Fatalf("unknown sub-kind error = %v, want ErrConflict", err)
	}
}

// A user-defined sub-kind is a style definition that applies to the text kind;
// once registered it can be assigned as a sub-kind.
func TestSetBlockSubkindCustom(t *testing.T) {
	d := newDocs()
	doc, _ := d.Create("p", "Doc", oneAtomDoc("hello"))

	// A custom sub-kind cannot be set before its style definition exists.
	if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetBlockSubkind, BlockID: "b1", SetSubKind: strp("callout")},
	}); !errors.Is(err, document.ErrConflict) {
		t.Fatalf("premature custom sub-kind = %v, want ErrConflict", err)
	}

	// Register the definition, then assign it.
	if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpPutStyleDefinition, Style: &document.StyleDefinition{
			ID: "callout", Name: "Callout", AppliesTo: []string{document.BlockKindText},
		}},
		{Op: document.OpSetBlockSubkind, BlockID: "b1", SetSubKind: strp("callout")},
	}); err != nil {
		t.Fatalf("custom sub-kind: %v", err)
	}
	if got, _ := d.Get("p", doc.ID); got.Base.Rows[0].Blocks[0].SubKind != "callout" {
		t.Fatalf("subKind = %q, want callout", got.Base.Rows[0].Blocks[0].SubKind)
	}
}

// set_block_subkind only applies to text blocks: a code block has no sub-kind.
func TestSetBlockSubkindOnlyTextBlocks(t *testing.T) {
	d := newDocs()
	base := document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{
		{ID: "c1", Kind: document.BlockKindCode, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "x := 1"}}},
	}}}}
	doc, err := d.Create("p", "Doc", base)
	if err != nil {
		t.Fatal(err)
	}
	_, err = submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetBlockSubkind, BlockID: "c1", SetSubKind: strp(document.SubKindHeading1)},
	})
	if !errors.Is(err, document.ErrConflict) {
		t.Fatalf("sub-kind on code block = %v, want ErrConflict", err)
	}
}

// A code block round-trips through Markdown as a fenced block, including blank
// lines inside the fence.
func TestMarkdownCodeRoundTrip(t *testing.T) {
	docs := document.New(document.NewMemoryStore(), document.Options{})
	md := "# Title\n\n```\nline one\n\nline three\n```\n"
	created, err := docs.ImportMarkdown("p", "Code", md)
	if err != nil {
		t.Fatalf("import: %v", err)
	}
	got, _ := docs.Get("p", created.ID)
	if len(got.Base.Rows) != 2 {
		t.Fatalf("rows = %d, want 2: %+v", len(got.Base.Rows), got.Base.Rows)
	}
	code := got.Base.Rows[1].Blocks[0]
	if code.Kind != document.BlockKindCode || code.DisplayText() != "line one\n\nline three" {
		t.Fatalf("code block = %+v", code)
	}
	_, out, err := docs.ExportMarkdown("p", created.ID)
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	want := "# Title\n\n```\nline one\n\nline three\n```\n"
	if out != want {
		t.Fatalf("export mismatch:\n got %q\nwant %q", out, want)
	}
}

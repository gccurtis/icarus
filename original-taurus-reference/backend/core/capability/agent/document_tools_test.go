package agent

import (
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

func TestMarkdownOpsToChangeOps(t *testing.T) {
	doc := document.Document{
		ID: "d1", Revision: 3,
		Base: document.Base{Rows: []document.Row{
			{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, SubKind: document.SubKindHeading1, Atoms: []document.Atom{{ID: "a1", Kind: "text", Text: "Title"}}}}},
			{ID: "r2", Blocks: []document.Block{{ID: "b2", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a2", Kind: "text", Text: "Body"}}}}},
		}},
	}
	ops := []markdownOp{
		{Op: "append", Kind: document.SubKindHeading2, Markdown: "New **section**"},
		{Op: "insert", AfterBlockID: "b1", Kind: document.BlockKindText, Markdown: "Inserted"},
		{Op: "delete", BlockID: "b2"},
	}
	changes, err := markdownOpsToChangeOps(doc, ops)
	if err != nil {
		t.Fatal(err)
	}
	if len(changes) != 3 {
		t.Fatalf("changes = %d, want 3", len(changes))
	}
	// append → InsertRow after the last row, heading_2 block with a bold mark.
	if changes[0].Op != document.OpInsertRow || changes[0].AfterRow != "r2" {
		t.Fatalf("append: %+v", changes[0])
	}
	if changes[0].Row == nil || changes[0].Row.Blocks[0].Kind != document.BlockKindText ||
		changes[0].Row.Blocks[0].SubKind != document.SubKindHeading2 {
		t.Fatalf("append block: %+v", changes[0].Row)
	}
	if len(changes[0].Row.Blocks[0].Marks) != 1 || changes[0].Row.Blocks[0].Marks[0].Kind != "bold" {
		t.Fatalf("append marks: %+v", changes[0].Row.Blocks[0].Marks)
	}
	// insert after b1 → InsertRow after r1.
	if changes[1].Op != document.OpInsertRow || changes[1].AfterRow != "r1" {
		t.Fatalf("insert: %+v", changes[1])
	}
	// delete b2 → DeleteRow r2.
	if changes[2].Op != document.OpDeleteRow || changes[2].RowID != "r2" {
		t.Fatalf("delete: %+v", changes[2])
	}
}

// A model writing markdown naturally writes the block marker too — it sends
// kind "heading_1" AND text "# Title". The kind already carries the structure,
// so keeping the marker in the atom leaves a heading whose text literally reads
// "# Title": the marker rendered twice, once as structure and once as content.
// Strip the marker that the declared kind already expresses — and only that
// one, so a paragraph about "#hashtags" keeps its text.
func TestNewTextRowStripsTheBlockMarkerTheKindAlreadyExpresses(t *testing.T) {
	for _, tc := range []struct{ name, kind, markdown, want string }{
		{"h1", document.SubKindHeading1, "# The Clockmaker's Orchard", "The Clockmaker's Orchard"},
		{"h2 deeper marker", document.SubKindHeading2, "## The Bell Before Dawn", "The Bell Before Dawn"},
		{"heading without a marker", document.SubKindHeading1, "Plain Title", "Plain Title"},
		{"quote", "quote", "> to be or not to be", "to be or not to be"},
		{"paragraph keeps a hash", "paragraph", "#hashtag stays put", "#hashtag stays put"},
		{"paragraph keeps a hash phrase", "paragraph", "# not a heading here", "# not a heading here"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			row, err := newTextRow(tc.kind, tc.markdown)
			if err != nil {
				t.Fatalf("newTextRow: %v", err)
			}
			var got string
			for _, a := range row.Blocks[0].Atoms {
				got += a.Text
			}
			if got != tc.want {
				t.Errorf("text = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestMarkdownOpsToChangeOpsRejects(t *testing.T) {
	doc := document.Document{ID: "d1", Base: document.Base{Rows: nil}}
	if _, err := markdownOpsToChangeOps(doc, []markdownOp{{Op: "append", Kind: "image", Markdown: "x"}}); err == nil {
		t.Fatal("unsupported kind should error")
	}
	if _, err := markdownOpsToChangeOps(doc, []markdownOp{{Op: "delete", BlockID: "nope"}}); err == nil {
		t.Fatal("unknown blockId should error")
	}
}

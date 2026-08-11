package document_test

import (
	"errors"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

// set_block_indent sets a block's indent level, is reversible, and is bounded.
func TestSetBlockIndent(t *testing.T) {
	d := newDocs()
	doc, err := d.Create("p", "Doc", oneAtomDoc("hello"))
	if err != nil {
		t.Fatal(err)
	}
	if got, _ := d.Get("p", doc.ID); got.Base.Rows[0].Blocks[0].Style.Indent != 0 {
		t.Fatalf("default indent = %d, want 0", got.Base.Rows[0].Blocks[0].Style.Indent)
	}

	cs, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetBlockIndent, BlockID: "b1", Indent: iptr(4)},
	})
	if err != nil {
		t.Fatalf("set indent: %v", err)
	}
	if got, _ := d.Get("p", doc.ID); got.Base.Rows[0].Blocks[0].Style.Indent != 4 {
		t.Fatalf("indent = %d, want 4", got.Base.Rows[0].Blocks[0].Style.Indent)
	}

	// Undo restores the prior indent.
	if _, err := d.Undo("p", doc.ID, "u", cs.ID); err != nil {
		t.Fatalf("undo: %v", err)
	}
	if got, _ := d.Get("p", doc.ID); got.Base.Rows[0].Blocks[0].Style.Indent != 0 {
		t.Fatalf("indent after undo = %d, want 0", got.Base.Rows[0].Blocks[0].Style.Indent)
	}
}

func TestSetBlockIndentBounds(t *testing.T) {
	d := newDocs()
	doc, _ := d.Create("p", "Doc", oneAtomDoc("hello"))
	_, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetBlockIndent, BlockID: "b1", Indent: iptr(document.MaxBlockIndent + 1)},
	})
	if !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Fatalf("over-max indent = %v, want ErrInvalidChangeSet", err)
	}
}

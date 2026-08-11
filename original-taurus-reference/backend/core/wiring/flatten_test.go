package wiring

import (
	"strings"
	"testing"

	doc "github.com/gccurtis/taurus-omega/core/capability/document"
)

// flatten feeds a document's text to the lattice. Inferred blocks (a prompt
// block's generated output) must be excluded, so the lattice never indexes its
// own output; only authored blocks contribute text and block spans.
func TestFlattenExcludesInferredBlocks(t *testing.T) {
	d := doc.Document{Base: doc.Base{Rows: []doc.Row{{ID: "r1", Blocks: []doc.Block{
		{ID: "b1", Kind: doc.BlockKindText, Atoms: []doc.Atom{{ID: "a1", Kind: doc.AtomKindText, Text: "authored source text"}}},
		{ID: "b2", Kind: doc.BlockKindPrompt, Inferred: true, Atoms: []doc.Atom{{ID: "a2", Kind: doc.AtomKindText, Text: "generated answer text"}}, Data: doc.PromptData{Instruction: "q"}},
		{ID: "b3", Kind: doc.BlockKindText, Atoms: []doc.Atom{{ID: "a3", Kind: doc.AtomKindText, Text: "more authored text"}}},
	}}}}}

	text, blocks := FlattenDocument(d)

	if strings.Contains(text, "generated answer text") {
		t.Errorf("flattened text contains inferred block output:\n%q", text)
	}
	if !strings.Contains(text, "authored source text") || !strings.Contains(text, "more authored text") {
		t.Errorf("flattened text dropped authored content:\n%q", text)
	}
	for _, b := range blocks {
		if b.BlockID == "b2" {
			t.Errorf("inferred block b2 produced a block span: %+v", b)
		}
	}
	if len(blocks) != 2 {
		t.Errorf("expected 2 authored block spans, got %d: %+v", len(blocks), blocks)
	}
}

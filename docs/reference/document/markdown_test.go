package document

import (
	"fmt"
	"testing"
)

func seqID() func() string {
	n := 0
	return func() string { n++; return fmt.Sprintf("id%d", n) }
}

func TestRenderBlockMarkdown(t *testing.T) {
	block := Block{
		Kind: BlockKindText,
		Atoms: []Atom{
			{ID: "a1", Kind: "text", Text: "This is "},
			{ID: "a2", Kind: "text", Text: "important"},
			{ID: "a3", Kind: "text", Text: " and "},
			{ID: "a4", Kind: "text", Text: "cited"},
			{ID: "a5", Kind: "text", Text: "."},
		},
		Marks: []Mark{
			{Kind: "bold", Start: Anchor{AtomID: "a2", Offset: 0}, End: Anchor{AtomID: "a2", Offset: 9}},
			{Kind: "link", Attrs: map[string]string{"href": "https://x"}, Start: Anchor{AtomID: "a4", Offset: 0}, End: Anchor{AtomID: "a4", Offset: 5}},
		},
	}
	got := RenderBlockMarkdown(block)
	want := "This is **important** and [cited](https://x)."
	if got != want {
		t.Fatalf("render:\n got %q\nwant %q", got, want)
	}
}

func TestParseBlockMarkdown(t *testing.T) {
	atoms, marks := ParseBlockMarkdown("This is **important** and _soft_ text.", seqID())
	var flat string
	byID := map[string]Atom{}
	for _, a := range atoms {
		flat += a.Text
		byID[a.ID] = a
	}
	if flat != "This is important and soft text." {
		t.Fatalf("flat text = %q", flat)
	}
	if len(marks) != 2 {
		t.Fatalf("marks = %d, want 2", len(marks))
	}
	if marks[0].Kind != "bold" || byID[marks[0].Start.AtomID].Text != "important" ||
		marks[0].End.Offset != len("important") {
		t.Fatalf("bold mark wrong: %+v over %q", marks[0], byID[marks[0].Start.AtomID].Text)
	}
	if marks[1].Kind != "italic" || byID[marks[1].Start.AtomID].Text != "soft" {
		t.Fatalf("italic mark wrong: %+v", marks[1])
	}
}

func TestMarkdownRoundTrip(t *testing.T) {
	md := "A **bold** and _italic_ and `code` and [link](https://e.com) end."
	atoms, marks := ParseBlockMarkdown(md, seqID())
	got := RenderBlockMarkdown(Block{Kind: BlockKindText, Atoms: atoms, Marks: marks})
	if got != md {
		t.Fatalf("round-trip:\n got %q\nwant %q", got, md)
	}
}

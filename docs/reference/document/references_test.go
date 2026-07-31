package document

import "testing"

func TestExtractOutgoingLinks(t *testing.T) {
	base := Base{Rows: []Row{
		{ID: "r1", Blocks: []Block{{ID: "b1", Kind: BlockKindText,
			Atoms: []Atom{{ID: "a1", Kind: AtomKindText, Text: "see target"}},
			Marks: []Mark{
				{Kind: MarkKindLink, Attrs: map[string]string{"href": "docX"}},
				{Kind: MarkKindLink, Attrs: map[string]string{"href": "docX"}}, // same block+href → deduped
				{Kind: MarkKindBold}, // not a link → ignored
				{Kind: MarkKindLink, Attrs: map[string]string{"href": "   "}},  // blank href → ignored
				{Kind: MarkKindLink, Attrs: map[string]string{"href": "docY"}}, // second target in same block
			}}}},
		{ID: "r2", Blocks: []Block{{ID: "b2", Kind: BlockKindText,
			Marks: []Mark{{Kind: MarkKindLink, Attrs: map[string]string{"href": "https://example.com"}}}}}},
	}}

	got := extractOutgoingLinks(base)
	if len(got) != 3 {
		t.Fatalf("want 3 links, got %d: %+v", len(got), got)
	}
	// Extraction preserves document order and keeps external hrefs (the resolver,
	// not the extractor, decides what resolves to a resource).
	want := []OutgoingLink{
		{Href: "docX", Anchor: "b1"},
		{Href: "docY", Anchor: "b1"},
		{Href: "https://example.com", Anchor: "b2"},
	}
	for i, w := range want {
		if got[i] != w {
			t.Errorf("link %d: got %+v, want %+v", i, got[i], w)
		}
	}
}

func TestExtractOutgoingLinksEmpty(t *testing.T) {
	if got := extractOutgoingLinks(Base{}); got != nil {
		t.Errorf("empty base: want nil, got %+v", got)
	}
}

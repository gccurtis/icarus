package reference

import "testing"

// fakeResolver treats any href that is a known document id as an in-project
// document reference, and knows a handful of current names. Everything else
// (external URLs, dangling ids) does not resolve.
type fakeResolver struct{ names map[string]string }

func (f fakeResolver) Resolve(_, href string) (kind, id, name string, ok bool) {
	if n, exists := f.names[href]; exists {
		return KindDocument, href, n, true
	}
	return "", "", "", false
}

func (f fakeResolver) Name(_, _, id string) (string, bool) {
	n, ok := f.names[id]
	return n, ok
}

func newRefs(t *testing.T, names map[string]string) *References {
	t.Helper()
	refs, err := New(NewMemoryStore(), fakeResolver{names: names})
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return refs
}

func TestReindexResolvesDropsAndDedups(t *testing.T) {
	scope := Scope{ProjectID: "p1"}
	refs := newRefs(t, map[string]string{"docA": "Alpha", "docB": "Beta", "docC": "Gamma"})

	err := refs.ReindexDocument(scope, "docA", []LinkRef{
		{Href: "docB", Anchor: "intro"},            // in-project → kept
		{Href: "docB", Anchor: "intro"},            // exact duplicate → dropped
		{Href: "https://example.com", Anchor: "x"}, // external → dropped
		{Href: "docA", Anchor: "self"},             // self-link → dropped
		{Href: "docGhost", Anchor: "y"},            // dangling → dropped
		{Href: "docC", Anchor: "later"},            // in-project → kept
	})
	if err != nil {
		t.Fatalf("ReindexDocument: %v", err)
	}

	out, err := refs.References(scope, KindDocument, "docA")
	if err != nil {
		t.Fatalf("References: %v", err)
	}
	if len(out) != 2 {
		t.Fatalf("want 2 edges, got %d: %+v", len(out), out)
	}
	// Sorted by From then To id: docB, docC.
	if out[0].To.ID != "docB" || out[0].To.Name != "Beta" || out[0].Anchor != "intro" {
		t.Errorf("edge 0 wrong: %+v", out[0])
	}
	if out[0].From.ID != "docA" || out[0].From.Name != "Alpha" || out[0].Kind != EdgeLink {
		t.Errorf("edge 0 from/kind wrong: %+v", out[0])
	}
	if out[1].To.ID != "docC" || out[1].To.Name != "Gamma" {
		t.Errorf("edge 1 wrong: %+v", out[1])
	}
}

func TestBacklinks(t *testing.T) {
	scope := Scope{ProjectID: "p1"}
	refs := newRefs(t, map[string]string{"docA": "Alpha", "docB": "Beta", "hub": "Hub"})

	if err := refs.ReindexDocument(scope, "docA", []LinkRef{{Href: "hub"}}); err != nil {
		t.Fatalf("reindex A: %v", err)
	}
	if err := refs.ReindexDocument(scope, "docB", []LinkRef{{Href: "hub"}}); err != nil {
		t.Fatalf("reindex B: %v", err)
	}

	back, err := refs.Backlinks(scope, KindDocument, "hub")
	if err != nil {
		t.Fatalf("Backlinks: %v", err)
	}
	if len(back) != 2 || back[0].From.ID != "docA" || back[1].From.ID != "docB" {
		t.Fatalf("want backlinks from docA and docB, got %+v", back)
	}
	if back[0].To.Name != "Hub" {
		t.Errorf("target name not resolved: %+v", back[0])
	}
}

func TestReindexReplaces(t *testing.T) {
	scope := Scope{ProjectID: "p1"}
	refs := newRefs(t, map[string]string{"docA": "Alpha", "docB": "Beta", "docC": "Gamma"})

	if err := refs.ReindexDocument(scope, "docA", []LinkRef{{Href: "docB"}}); err != nil {
		t.Fatalf("reindex 1: %v", err)
	}
	// Re-index with a different link set: docB edge must be gone, docC present.
	if err := refs.ReindexDocument(scope, "docA", []LinkRef{{Href: "docC"}}); err != nil {
		t.Fatalf("reindex 2: %v", err)
	}
	out, _ := refs.References(scope, KindDocument, "docA")
	if len(out) != 1 || out[0].To.ID != "docC" {
		t.Fatalf("reindex should replace, got %+v", out)
	}
	// docB should now have no backlinks.
	back, _ := refs.Backlinks(scope, KindDocument, "docB")
	if len(back) != 0 {
		t.Fatalf("docB backlinks should be empty after replace, got %+v", back)
	}
}

func TestScopeRequired(t *testing.T) {
	refs := newRefs(t, nil)
	if err := refs.ReindexDocument(Scope{}, "docA", nil); err != ErrInvalidScope {
		t.Errorf("ReindexDocument: want ErrInvalidScope, got %v", err)
	}
	if _, err := refs.References(Scope{}, KindDocument, "docA"); err != ErrInvalidScope {
		t.Errorf("References: want ErrInvalidScope, got %v", err)
	}
	if _, err := refs.Backlinks(Scope{}, KindDocument, "docA"); err != ErrInvalidScope {
		t.Errorf("Backlinks: want ErrInvalidScope, got %v", err)
	}
}

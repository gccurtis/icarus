package resource_test

import (
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

func TestResourcePinnedSurfacesInListAndGet(t *testing.T) {
	now := time.Now().UTC()
	fam := &fakeFamily{kind: resource.KindDocument, items: []resource.Summary{
		{ID: "a", Kind: resource.KindDocument, Name: "Alpha", UpdatedAt: now},
		{ID: "b", Kind: resource.KindDocument, Name: "Beta", UpdatedAt: now.Add(-time.Hour)},
	}}
	store := resource.NewMemoryAttributeStore()
	svc, err := resource.NewWithAttributes(store, fam)
	if err != nil {
		t.Fatalf("NewWithAttributes: %v", err)
	}

	// Default: nothing pinned.
	page, _ := svc.List("p1", resource.PageRequest{})
	for _, s := range page.Resources {
		if s.Pinned {
			t.Fatalf("nothing should be pinned yet: %+v", s)
		}
	}

	// Pin "a".
	if err := svc.SetPinned("p1", resource.KindDocument, "a", true); err != nil {
		t.Fatalf("SetPinned: %v", err)
	}
	page, _ = svc.List("p1", resource.PageRequest{})
	got := map[string]bool{}
	for _, s := range page.Resources {
		got[s.ID] = s.Pinned
	}
	if !got["a"] || got["b"] {
		t.Fatalf("expected only a pinned in list, got %+v", got)
	}
	one, _ := svc.Get("p1", resource.KindDocument, "a")
	if !one.Pinned {
		t.Errorf("Get should report a as pinned: %+v", one)
	}

	// Unpin.
	if err := svc.SetPinned("p1", resource.KindDocument, "a", false); err != nil {
		t.Fatalf("unpin: %v", err)
	}
	if one, _ := svc.Get("p1", resource.KindDocument, "a"); one.Pinned {
		t.Errorf("a should be unpinned")
	}
}

func TestResourcePinnedIsProjectScoped(t *testing.T) {
	fam := &fakeFamily{kind: resource.KindDocument, items: []resource.Summary{
		{ID: "a", Kind: resource.KindDocument, Name: "Alpha", UpdatedAt: time.Now().UTC()},
	}}
	svc, _ := resource.NewWithAttributes(resource.NewMemoryAttributeStore(), fam)

	if err := svc.SetPinned("p1", resource.KindDocument, "a", true); err != nil {
		t.Fatalf("SetPinned: %v", err)
	}
	// A different project sees the same family item unpinned (attributes are
	// keyed by project).
	page, _ := svc.List("p2", resource.PageRequest{})
	for _, s := range page.Resources {
		if s.Pinned {
			t.Errorf("p2 must not see p1's pin: %+v", s)
		}
	}
}

// A nil attribute store (the default New) simply reports nothing pinned and
// rejects SetPinned, so pinning is opt-in via NewWithAttributes.
func TestResourceNoAttributeStore(t *testing.T) {
	fam := &fakeFamily{kind: resource.KindDocument, items: []resource.Summary{
		{ID: "a", Kind: resource.KindDocument, Name: "Alpha", UpdatedAt: time.Now().UTC()},
	}}
	svc, _ := resource.New(fam)
	if err := svc.SetPinned("p1", resource.KindDocument, "a", true); err == nil {
		t.Errorf("SetPinned without an attribute store should error")
	}
	page, _ := svc.List("p1", resource.PageRequest{})
	if len(page.Resources) != 1 || page.Resources[0].Pinned {
		t.Errorf("list should work with no attribute store, nothing pinned: %+v", page.Resources)
	}
}

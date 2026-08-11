package resource_test

import (
	"errors"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/resource"
)

type fakeFamily struct {
	kind  resource.Kind
	items []resource.Summary
}

func (f *fakeFamily) Kind() resource.Kind { return f.kind }
func (f *fakeFamily) Get(_ string, id string) (resource.Summary, error) {
	for _, item := range f.items {
		if item.ID == id {
			return item, nil
		}
	}
	return resource.Summary{}, resource.ErrNotFound
}
func (f *fakeFamily) List(_ string, before *resource.Boundary, limit int) ([]resource.Summary, error) {
	var out []resource.Summary
	for _, item := range f.items {
		if before != nil {
			after := item.UpdatedAt.Before(before.UpdatedAt) ||
				(item.UpdatedAt.Equal(before.UpdatedAt) && (item.Kind > before.Kind || (item.Kind == before.Kind && item.ID > before.ID)))
			if !after {
				continue
			}
		}
		out = append(out, item)
		if len(out) == limit {
			break
		}
	}
	return out, nil
}
func (f *fakeFamily) Create(_ string, _ resource.Actor, name string) (resource.Summary, error) {
	return resource.Summary{ID: "new", Kind: f.kind, Name: name}, nil
}
func (f *fakeFamily) Rename(_ string, _ resource.Actor, id, name string) (resource.Summary, error) {
	return resource.Summary{ID: id, Kind: f.kind, Name: name}, nil
}
func (f *fakeFamily) Delete(_ string, _ resource.Actor, _ string) error { return nil }

func TestCatalogMergesFamiliesAndPages(t *testing.T) {
	now := time.Now().UTC()
	docs := &fakeFamily{kind: resource.KindDocument, items: []resource.Summary{
		{ID: "a", Kind: resource.KindDocument, UpdatedAt: now},
		{ID: "b", Kind: resource.KindDocument, UpdatedAt: now.Add(-time.Hour)},
	}}
	slides := &fakeFamily{kind: resource.KindSlides, items: []resource.Summary{
		{ID: "s", Kind: resource.KindSlides, UpdatedAt: now},
	}}
	svc, err := resource.New(docs, slides)
	if err != nil {
		t.Fatal(err)
	}
	first, err := svc.List("p", resource.PageRequest{Limit: 2})
	if err != nil || len(first.Resources) != 2 || first.Resources[0].ID != "a" || first.Resources[1].ID != "s" || first.NextCursor == "" {
		t.Fatalf("first = %+v, %v", first, err)
	}
	second, err := svc.List("p", resource.PageRequest{Limit: 2, Cursor: first.NextCursor})
	if err != nil || len(second.Resources) != 1 || second.Resources[0].ID != "b" {
		t.Fatalf("second = %+v, %v", second, err)
	}
}

func TestKindAvailabilityAndValidation(t *testing.T) {
	svc, _ := resource.New(&fakeFamily{kind: resource.KindDocument})
	if _, err := svc.Create("p", resource.Actor{}, resource.Kind("bogus"), "x"); !errors.Is(err, resource.ErrUnknownKind) {
		t.Fatalf("unknown kind = %v", err)
	}
	if _, err := svc.Create("p", resource.Actor{}, resource.KindSlides, "x"); !errors.Is(err, resource.ErrUnavailableKind) {
		t.Fatalf("unavailable kind = %v", err)
	}
	if _, err := svc.Create("p", resource.Actor{}, resource.KindDocument, "   "); !errors.Is(err, resource.ErrInvalidName) {
		t.Fatalf("blank name = %v", err)
	}
	if _, err := resource.New(&fakeFamily{kind: resource.KindDocument}, &fakeFamily{kind: resource.KindDocument}); !errors.Is(err, resource.ErrDuplicateFamily) {
		t.Fatalf("duplicate family = %v", err)
	}
	if err := svc.ValidateFamilies(resource.KindDocument, resource.KindConnector); !errors.Is(err, resource.ErrMissingFamily) {
		t.Fatalf("missing required family = %v", err)
	}
	if err := svc.ValidateFamilies(resource.KindDocument); err != nil {
		t.Fatalf("complete family registry = %v", err)
	}
	if err := svc.ValidateBoundPorts(); err == nil {
		t.Fatal("missing required organization membership port was accepted")
	}
}

func TestParseKindAcceptsConnector(t *testing.T) {
	kind, err := resource.ParseKind("connector")
	if err != nil {
		t.Fatalf("ParseKind(connector): %v", err)
	}
	if kind != resource.KindConnector {
		t.Fatalf("got %q, want %q", kind, resource.KindConnector)
	}
}

func TestGetUsesTheCanonicalFamily(t *testing.T) {
	now := time.Now().UTC()
	svc, err := resource.New(&fakeFamily{kind: resource.KindDocument, items: []resource.Summary{{ID: "doc", Name: "Plan", UpdatedAt: now}}})
	if err != nil {
		t.Fatal(err)
	}
	got, err := svc.Get("p", resource.KindDocument, "doc")
	if err != nil || got.ID != "doc" || got.Kind != resource.KindDocument || got.Name != "Plan" {
		t.Fatalf("Get = %+v, %v", got, err)
	}
	if _, err := svc.Get("p", resource.KindDocument, "missing"); !errors.Is(err, resource.ErrNotFound) {
		t.Fatalf("missing Get = %v; want ErrNotFound", err)
	}
	if _, err := svc.Get("p", resource.KindSlides, "deck"); !errors.Is(err, resource.ErrUnavailableKind) {
		t.Fatalf("unavailable Get = %v; want ErrUnavailableKind", err)
	}
	if _, err := svc.Get("p", resource.Kind("bogus"), "x"); !errors.Is(err, resource.ErrUnknownKind) {
		t.Fatalf("unknown Get = %v; want ErrUnknownKind", err)
	}
}

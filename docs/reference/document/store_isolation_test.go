package document_test

import (
	"errors"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

// TestStoreDocumentReadsAreProjectScoped pins DEF-1 at the document port: the
// store's by-id read carries the project label itself, so a foreign project is
// refused by the store rather than only by the service comparing ProjectID
// afterwards. The service's own comparison stays in place — two independent
// layers, neither load-bearing alone.
func TestStoreDocumentReadsAreProjectScoped(t *testing.T) {
	store := document.NewMemoryStore()
	docs := document.New(store, document.Options{})
	doc, err := docs.Create("projA", "A", document.Base{})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	if got, err := store.DocumentByID("projA", doc.ID); err != nil || got.ID != doc.ID {
		t.Fatalf("owning-project DocumentByID = %+v, %v", got, err)
	}
	if got, err := store.DocumentByID("projB", doc.ID); !errors.Is(err, document.ErrNotFound) {
		t.Errorf("foreign-project DocumentByID = %+v, %v; want ErrNotFound", got, err)
	}
}

// TestMemoryStoreReturnsIndependentLoads pins down that the in-memory store
// hands out an independent copy of each document on every load. A caller that
// mutates a returned Base must not affect what a later load sees, and must not
// race a concurrent load/clone of the same document. Before store isolation,
// DocumentByID returned the Document by value, sharing the Base.Rows backing
// array with the stored copy — so this leaked the mutation.
func TestMemoryStoreReturnsIndependentLoads(t *testing.T) {
	store := document.NewMemoryStore()
	now := time.Unix(1, 0).UTC()
	doc := document.Document{
		ID:        "doc1",
		ProjectID: "p",
		Name:      "Isolation",
		Base: document.Base{Rows: []document.Row{{
			ID: "r1",
			Blocks: []document.Block{{
				ID:    "b1",
				Kind:  document.BlockKindText,
				Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "original"}},
			}},
		}}},
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := store.CreateDocument(doc, document.ActivityFact{}); err != nil {
		t.Fatal(err)
	}

	first, err := store.DocumentByID("p", "doc1")
	if err != nil {
		t.Fatal(err)
	}
	first.Base.Rows[0].Blocks[0].Atoms[0].Text = "MUTATED"

	second, err := store.DocumentByID("p", "doc1")
	if err != nil {
		t.Fatal(err)
	}
	if got := second.Base.Rows[0].Blocks[0].Atoms[0].Text; got != "original" {
		t.Fatalf("second load reflects a caller's mutation of the first load: got %q, want %q", got, "original")
	}
}

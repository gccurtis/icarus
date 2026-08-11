package names_test

import (
	"errors"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/formula"
	"github.com/gccurtis/taurus-omega/core/capability/formula/names"
)

func TestMemoryStoreRoundTrip(t *testing.T) {
	store := names.NewMemoryStore()
	price, _ := formula.NumberValue("42")
	entry := names.Entry{Name: "price", Type: names.TypeNumber, Value: price}

	if err := store.PutName("p1", entry); err != nil {
		t.Fatalf("PutName: %v", err)
	}
	got, err := store.Name("p1", "price")
	if err != nil || got.Name != "price" || got.Type != names.TypeNumber {
		t.Fatalf("Name = %+v, %v; want the stored entry", got, err)
	}
	// Project isolation.
	if _, err := store.Name("p2", "price"); !errors.Is(err, names.ErrNotFound) {
		t.Errorf("Name in other project = %v; want ErrNotFound", err)
	}
	list, err := store.Names("p1")
	if err != nil || len(list) != 1 {
		t.Fatalf("Names = %v, %v; want one entry", list, err)
	}
	if err := store.DeleteName("p1", "price"); err != nil {
		t.Fatalf("DeleteName: %v", err)
	}
	if _, err := store.Name("p1", "price"); !errors.Is(err, names.ErrNotFound) {
		t.Errorf("after delete = %v; want ErrNotFound", err)
	}
	if err := store.DeleteName("p1", "price"); !errors.Is(err, names.ErrNotFound) {
		t.Errorf("delete absent = %v; want ErrNotFound", err)
	}
}

package document_test

import (
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	doc "github.com/gccurtis/taurus-omega/core/capability/document"
	"github.com/gccurtis/taurus-omega/core/endpoint"
	documentapp "github.com/gccurtis/taurus-omega/core/handlers/document"
)

// TestListHidesInaccessibleDocuments pins PRIV-1: GET /documents must not leak
// the existence/name/author of a document the caller is excluded from by its
// access scope, matching the /resources catalog which already filters.
func TestListHidesInaccessibleDocuments(t *testing.T) {
	store := doc.NewMemoryStore()
	for _, id := range []string{"open", "secret"} {
		if err := store.CreateDocument(
			doc.Document{ID: id, ProjectID: "p", Name: id, Lifecycle: doc.LifecycleActive},
			doc.ActivityFact{},
		); err != nil {
			t.Fatal(err)
		}
	}
	docs := doc.New(store, doc.Options{})
	// "secret" is restricted from this caller; "open" is visible.
	canAccess := func(_, _, documentID string) (bool, error) { return documentID != "secret", nil }
	h := documentapp.NewHandlers(docs, canAccess)

	ctx := access.Context{User: access.User{ID: "bob"}, Project: &access.Project{ID: "p"}, Role: access.RoleEdit}
	resp := h.List(ctx, endpoint.Request{})
	if resp.Status != 200 {
		t.Fatalf("status = %d, want 200", resp.Status)
	}
	body, ok := resp.Body.(map[string]any)
	if !ok {
		t.Fatalf("body type = %T", resp.Body)
	}
	list, ok := body["documents"].([]doc.Summary)
	if !ok {
		t.Fatalf("documents type = %T", body["documents"])
	}
	if len(list) != 1 || list[0].ID != "open" {
		t.Fatalf("List returned %+v, want only the accessible 'open' document", list)
	}
}

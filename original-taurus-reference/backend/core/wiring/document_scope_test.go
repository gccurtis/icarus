package wiring

import (
	"context"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/contexts"
	"github.com/gccurtis/taurus-omega/core/capability/document"
)

func TestDocumentScopeResolverExpandsContext(t *testing.T) {
	svc := contexts.New(contexts.NewMemoryStore())

	created, err := svc.Create("p", contexts.Actor{ID: "u1", Name: "Ada"}, "Leaves", []contexts.Ref{
		{Kind: "document", ID: "leaf1"},
		{Kind: "document", ID: "leaf2"},
	}, nil)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	r := documentScopeResolver{contexts: svc}

	got, err := r.ExpandScope(context.Background(), "p", []document.ScopeOrigin{{Kind: "context", ID: created.ID}}, nil)
	if err != nil {
		t.Fatalf("ExpandScope: %v", err)
	}
	want := []document.ScopeOrigin{{Kind: "document", ID: "leaf1"}, {Kind: "document", ID: "leaf2"}}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("ExpandScope = %+v; want %+v", got, want)
	}

	passthrough, err := r.ExpandScope(context.Background(), "p", []document.ScopeOrigin{{Kind: "document", ID: "d9"}}, nil)
	if err != nil {
		t.Fatalf("ExpandScope (non-context): %v", err)
	}
	wantPassthrough := []document.ScopeOrigin{{Kind: "document", ID: "d9"}}
	if len(passthrough) != 1 || passthrough[0] != wantPassthrough[0] {
		t.Fatalf("ExpandScope passthrough = %+v; want %+v", passthrough, wantPassthrough)
	}
}

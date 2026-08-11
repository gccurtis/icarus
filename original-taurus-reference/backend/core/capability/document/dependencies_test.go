package document_test

import (
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

// seedScopedPromptDoc creates a document declaring one context variable bound to
// a resource, plus a prompt block scoped (include) to that variable.
func seedScopedPromptDoc(t *testing.T, d *document.Documents, varName string, ref document.ResourceRef, blockID string) document.Document {
	t.Helper()
	base := document.Base{
		Template: &document.TemplateInfo{Variables: []document.ContextVariable{
			{Name: varName, BoundResource: &ref},
		}},
		Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{
			ID: blockID, Kind: document.BlockKindPrompt,
			Data:    document.PromptData{Instruction: "summarize"},
			Context: &document.BlockContext{Include: []string{varName}},
		}}}},
	}
	doc, err := d.Create("p", "Doc", base)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	return doc
}

func TestDependentPromptsMatchesScope(t *testing.T) {
	d := newDocs()
	doc1 := seedScopedPromptDoc(t, d, "sales", document.ResourceRef{Kind: "connector", ID: "CA"}, "pb1")
	_ = seedScopedPromptDoc(t, d, "ops", document.ResourceRef{Kind: "connector", ID: "CB"}, "pb2")

	got, err := d.DependentPrompts("p", document.ScopeOrigin{Kind: "connector", ID: "CA"})
	if err != nil {
		t.Fatalf("DependentPrompts: %v", err)
	}
	if len(got) != 1 || got[0] != (document.PromptLocation{DocumentID: doc1.ID, BlockID: "pb1"}) {
		t.Fatalf("got %+v; want only doc1/pb1", got)
	}

	// A source nothing depends on yields nothing.
	none, err := d.DependentPrompts("p", document.ScopeOrigin{Kind: "connector", ID: "GHOST"})
	if err != nil {
		t.Fatalf("DependentPrompts ghost: %v", err)
	}
	if len(none) != 0 {
		t.Fatalf("ghost source had dependents: %+v", none)
	}
}

// TestDependentPromptsSeesPendingContext pins down that a block context set by a
// still-pending change set is visible to DependentPrompts — the cascade must find
// a dependent whose scope was just edited, not only ones folded into the stored
// base. (List returns the unresolved base; DependentPrompts must resolve.)
func TestDependentPromptsSeesPendingContext(t *testing.T) {
	d := newDocs()
	// Create with the variable declared but the block UNscoped; then scope it via
	// a submitted op (which stays pending until re-base).
	base := document.Base{
		Template: &document.TemplateInfo{Variables: []document.ContextVariable{
			{Name: "sales", BoundResource: &document.ResourceRef{Kind: "connector", ID: "CA"}},
		}},
		Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{
			ID: "pb", Kind: document.BlockKindPrompt, Data: document.PromptData{Instruction: "x"},
		}}}},
	}
	doc, err := d.Create("p", "Doc", base)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := submitChanges(d, "p", doc.ID, "u1", []document.ChangeOp{{
		Op: document.OpSetBlockContext, BlockID: "pb",
		BlockContext: &document.BlockContext{Include: []string{"sales"}},
	}}); err != nil {
		t.Fatalf("submit: %v", err)
	}
	got, err := d.DependentPrompts("p", document.ScopeOrigin{Kind: "connector", ID: "CA"})
	if err != nil {
		t.Fatalf("DependentPrompts: %v", err)
	}
	if len(got) != 1 || got[0] != (document.PromptLocation{DocumentID: doc.ID, BlockID: "pb"}) {
		t.Fatalf("pending block context not seen: %+v", got)
	}
}

// fakeScopeReferences is a document.ScopeReferences stub keyed on the
// context id and origin it should report as referenced.
type fakeScopeReferences struct {
	contextID string
	origin    document.ScopeOrigin
}

func (f fakeScopeReferences) ContextReferences(_, contextID string, origin document.ScopeOrigin) (bool, error) {
	return contextID == f.contextID && origin == f.origin, nil
}

// TestDependentPromptsSeesThroughContext pins down the deep-cascade gap: a
// block whose variable binds to a CONTEXT (not the connector itself) still
// shows up as a dependent of a connector change, when a ScopeReferences port
// reports that the context transitively contains that connector.
func TestDependentPromptsSeesThroughContext(t *testing.T) {
	d := newDocs()
	connectorOrigin := document.ScopeOrigin{Kind: "connector", ID: "X"}
	doc := seedScopedPromptDoc(t, d, "ctxVar", document.ResourceRef{Kind: "context", ID: "C"}, "pb")

	// With no ScopeReferences wired, a context-bound block does NOT match a
	// connector change — today's direct-origin-only behavior is unchanged.
	none, err := d.DependentPrompts("p", connectorOrigin)
	if err != nil {
		t.Fatalf("DependentPrompts (no port): %v", err)
	}
	if len(none) != 0 {
		t.Fatalf("context-only block matched a connector change with no ScopeReferences wired: %+v", none)
	}

	// Direct-origin match is still unaffected: a block bound straight to the
	// connector still matches regardless of the port.
	doc2 := seedScopedPromptDoc(t, d, "direct", document.ResourceRef{Kind: "connector", ID: "X"}, "pb2")
	direct, err := d.DependentPrompts("p", connectorOrigin)
	if err != nil {
		t.Fatalf("DependentPrompts (direct, no port): %v", err)
	}
	if len(direct) != 1 || direct[0] != (document.PromptLocation{DocumentID: doc2.ID, BlockID: "pb2"}) {
		t.Fatalf("direct-origin match broken: got %+v", direct)
	}

	// Wire a fake ScopeReferences that knows context C transitively contains
	// connector X; now the context-bound block matches too.
	d.UseScopeReferences(fakeScopeReferences{contextID: "C", origin: connectorOrigin})
	got, err := d.DependentPrompts("p", connectorOrigin)
	if err != nil {
		t.Fatalf("DependentPrompts (with port): %v", err)
	}
	found := map[document.PromptLocation]bool{}
	for _, loc := range got {
		found[loc] = true
	}
	if !found[(document.PromptLocation{DocumentID: doc.ID, BlockID: "pb"})] {
		t.Fatalf("context-bound block not found via ScopeReferences: %+v", got)
	}
	if !found[(document.PromptLocation{DocumentID: doc2.ID, BlockID: "pb2"})] {
		t.Fatalf("direct-origin block missing when port is wired: %+v", got)
	}
	if len(got) != 2 {
		t.Fatalf("unexpected extra matches: %+v", got)
	}
}

func TestDependentPromptsIgnoresUnscopedAndNonPromptBlocks(t *testing.T) {
	d := newDocs()
	// A prompt block with no context selection, plus a text block — neither depends
	// on any source, so the query returns nothing.
	base := document.Base{
		Template: &document.TemplateInfo{Variables: []document.ContextVariable{
			{Name: "sales", BoundResource: &document.ResourceRef{Kind: "connector", ID: "CA"}},
		}},
		Rows: []document.Row{{ID: "r1", Blocks: []document.Block{
			{ID: "pb", Kind: document.BlockKindPrompt, Data: document.PromptData{Instruction: "x"}},
			{ID: "t1", Kind: document.BlockKindText},
		}}},
	}
	if _, err := d.Create("p", "Doc", base); err != nil {
		t.Fatal(err)
	}
	got, err := d.DependentPrompts("p", document.ScopeOrigin{Kind: "connector", ID: "CA"})
	if err != nil {
		t.Fatalf("DependentPrompts: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("unscoped/non-prompt blocks matched: %+v", got)
	}
}

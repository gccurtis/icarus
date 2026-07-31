package document_test

import (
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

func newDocs() *document.Documents {
	return document.New(document.NewMemoryStore(), document.Options{})
}

func TestCreateAssignsIDs(t *testing.T) {
	d := newDocs()
	base := document.Base{Rows: []document.Row{
		{Blocks: []document.Block{{Atoms: []document.Atom{{Text: "hello"}}}}},
	}}

	doc, err := d.Create("proj1", "Notes", base)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if doc.ID == "" || doc.ProjectID != "proj1" || doc.Name != "Notes" {
		t.Fatalf("doc = %+v", doc)
	}
	block := doc.Base.Rows[0].Blocks[0]
	// Ids are assigned down to the atom, and kinds are defaulted.
	if len(doc.Base.Rows) != 1 || doc.Base.Rows[0].ID == "" || block.ID == "" || block.Atoms[0].ID == "" {
		t.Errorf("row/block/atom IDs not assigned: %+v", doc.Base)
	}
	if block.Kind != "text" || block.Atoms[0].Kind != "text" {
		t.Errorf("kinds not defaulted: %+v", block)
	}
	if block.DisplayText() != "hello" {
		t.Errorf("block content lost: %+v", block)
	}

	if _, err := d.Create("proj1", "   ", document.Base{}); !errors.Is(err, document.ErrInvalidName) {
		t.Errorf("empty name: got %v, want ErrInvalidName", err)
	}
}

func TestGetListDeleteScopedToProject(t *testing.T) {
	d := newDocs()
	a, _ := d.Create("projA", "A", document.Base{})
	if _, err := d.Create("projB", "B", document.Base{}); err != nil {
		t.Fatal(err)
	}

	if list, _ := d.List("projA"); len(list) != 1 || list[0].ID != a.ID {
		t.Fatalf("list projA = %+v", list)
	}

	if got, err := d.Get("projA", a.ID); err != nil || got.ID != a.ID {
		t.Fatalf("get: %+v, %v", got, err)
	}
	if _, err := d.Get("projB", a.ID); !errors.Is(err, document.ErrNotFound) {
		t.Errorf("cross-project get: got %v, want ErrNotFound", err)
	}
	if _, err := d.Get("projA", "missing"); !errors.Is(err, document.ErrNotFound) {
		t.Errorf("unknown get: got %v, want ErrNotFound", err)
	}

	// A document cannot be deleted (trashed) from another project.
	if err := d.Delete("projB", a.ID); !errors.Is(err, document.ErrNotFound) {
		t.Errorf("cross-project delete: got %v, want ErrNotFound", err)
	}
	if err := d.Delete("projA", a.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	// Trashed documents are excluded from List but still Gettable.
	if list, _ := d.List("projA"); len(list) != 0 {
		t.Fatalf("list after trash: want 0, got %d", len(list))
	}
	if got, err := d.Get("projA", a.ID); err != nil || got.ID != a.ID || got.Lifecycle != document.LifecycleTrashed {
		t.Fatalf("get after trash: %+v, %v, lifecycle=%s", got, err, got.Lifecycle)
	}
	// Restore brings it back.
	if err := d.Restore("projA", a.ID, document.Actor{ID: "u1", Name: "Tester"}); err != nil {
		t.Fatalf("restore: %v", err)
	}
	if list, _ := d.List("projA"); len(list) != 1 {
		t.Fatalf("list after restore: want 1, got %d", len(list))
	}
}

func TestDocumentMutationsCommitActivityAndVisibleTimestamps(t *testing.T) {
	store := document.NewMemoryStore()
	docs := document.New(store, document.Options{})
	actor := document.Actor{ID: "u1", Name: "Ada"}
	doc, err := docs.Create("p", "Plan", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{
		ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "draft"}},
	}}}}}, actor)
	if err != nil {
		t.Fatal(err)
	}
	if facts := store.ActivityFacts(); len(facts) != 1 || facts[0].Action != document.ActivityCreated || facts[0].Actor != actor {
		t.Fatalf("create facts = %+v", facts)
	}

	renamed, err := docs.Rename("p", doc.ID, "  Launch Plan  ", actor)
	if err != nil || renamed.Name != "Launch Plan" {
		t.Fatalf("rename = %+v, %v", renamed, err)
	}
	if _, err := docs.Rename("p", doc.ID, "Launch Plan", actor); err != nil {
		t.Fatal(err)
	}
	if facts := store.ActivityFacts(); len(facts) != 2 || facts[1].Action != document.ActivityRenamed || facts[1].TargetName != "Launch Plan" {
		t.Fatalf("rename facts = %+v", facts)
	}

	updated := "ready"
	cs, err := submitChanges(docs, "p", doc.ID, actor.ID, []document.ChangeOp{{
		Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: &updated,
	}}, actor.Name)
	if err != nil {
		t.Fatal(err)
	}
	stored, _ := store.DocumentByID("p", doc.ID)
	if !stored.UpdatedAt.Equal(cs.CreatedAt) {
		t.Fatalf("document updatedAt = %v; want change time %v", stored.UpdatedAt, cs.CreatedAt)
	}
	if err := docs.Rebase(nil, "p", doc.ID); err != nil {
		t.Fatal(err)
	}
	afterRebase, _ := store.DocumentByID("p", doc.ID)
	if !afterRebase.UpdatedAt.Equal(cs.CreatedAt) {
		t.Fatalf("rebase changed visible timestamp: %v -> %v", cs.CreatedAt, afterRebase.UpdatedAt)
	}

	if err := docs.Delete("p", doc.ID, actor); err != nil {
		t.Fatal(err)
	}
	facts := store.ActivityFacts()
	if len(facts) != 4 || facts[2].Action != document.ActivityEdited || facts[3].Action != document.ActivityTrashed {
		t.Fatalf("all facts = %+v", facts)
	}
	if facts[2].Actor != actor || facts[2].SourceKind != "document.change_set" || facts[2].SourceID != cs.ID {
		t.Fatalf("edit fact is not linked to its authored revision: %+v, change set %+v", facts[2], cs)
	}
	if facts[3].TargetName != "Launch Plan" {
		t.Fatalf("delete lost target snapshot: %+v", facts[3])
	}
}

// A prompt block round-trips through JSON with its typed PromptData intact — the
// custom decoder selects the subtype from the block's kind.
func TestPromptBlockJSONRoundTrip(t *testing.T) {
	b := document.Block{
		ID:    "b1",
		Kind:  document.BlockKindPrompt,
		Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "generated line"}},
		Data: document.PromptData{
			Instruction: "summarize the plant docs",
			Status:      document.PromptStatusOK,
			Evidence:    []document.EvidenceSpan{{SourceType: "document", SourceID: "d1", Start: 0, End: 12, Text: "photosynth..."}},
			LastOutput:  "generated line",
		},
	}
	raw, err := json.Marshal(b)
	if err != nil {
		t.Fatal(err)
	}
	var got document.Block
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatal(err)
	}
	pd, ok := got.Data.(document.PromptData)
	if !ok {
		t.Fatalf("Data is not PromptData: %T", got.Data)
	}
	if pd.Instruction != "summarize the plant docs" || pd.Status != document.PromptStatusOK {
		t.Errorf("prompt data lost fields: %+v", pd)
	}
	if len(pd.Evidence) != 1 || pd.Evidence[0].SourceID != "d1" || pd.Evidence[0].End != 12 {
		t.Errorf("evidence lost: %+v", pd.Evidence)
	}
	if got.Atoms[0].Text != "generated line" {
		t.Errorf("atoms lost: %+v", got.Atoms)
	}

	// A plain block decodes with no Data.
	var plain document.Block
	if err := json.Unmarshal([]byte(`{"id":"b2","kind":"text","atoms":[{"id":"a","kind":"text","text":"hi"}]}`), &plain); err != nil {
		t.Fatal(err)
	}
	if plain.Data != nil {
		t.Errorf("plain block got Data: %+v", plain.Data)
	}
}

// Creating a document with a prompt block normalizes it to Inferred with a
// PromptData, and its typed data survives storage round-trip.
func TestCreatePromptBlockNormalizesInferred(t *testing.T) {
	d := newDocs()
	base := document.Base{Rows: []document.Row{{Blocks: []document.Block{
		{Kind: document.BlockKindText, Atoms: []document.Atom{{Text: "intro"}}},
		{Kind: document.BlockKindPrompt, Data: document.PromptData{Instruction: "what is X?"}},
	}}}}
	doc, err := d.Create("p", "Doc", base)
	if err != nil {
		t.Fatal(err)
	}
	blocks := doc.Base.Rows[0].Blocks
	if blocks[0].Inferred {
		t.Errorf("paragraph should not be inferred")
	}
	pb := blocks[1]
	if !pb.Inferred {
		t.Errorf("prompt block should be inferred")
	}
	if pb.ID == "" {
		t.Errorf("prompt block got no id")
	}
	if _, ok := pb.Data.(document.PromptData); !ok {
		t.Errorf("prompt block Data = %T, want PromptData", pb.Data)
	}

	// Re-fetch: the prompt block (with its typed Data) survives the store.
	got, err := d.Get("p", doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	pd, ok := got.Base.Rows[0].Blocks[1].Data.(document.PromptData)
	if !ok || pd.Instruction != "what is X?" {
		t.Errorf("prompt data did not survive storage: %+v (%T)", got.Base.Rows[0].Blocks[1].Data, got.Base.Rows[0].Blocks[1].Data)
	}
}

func TestStyleRegistryRoundTrip(t *testing.T) {
	d := newDocs()
	background := document.BackgroundMuted
	base := document.Base{
		StyleRegistry: document.StyleRegistry{
			Definitions: []document.StyleDefinition{
				{
					ID:         "body-callout",
					Name:       "Body Callout",
					AppliesTo:  []string{document.BlockKindText},
					Typography: document.TypographyBody,
					Spacing:    document.SpacingRelaxed,
					Padding:    document.PaddingNormal,
					Border:     document.BorderSubtle,
					Background: document.BackgroundSubtle,
					Tone:       document.ToneAccent,
					AllowOverrides: []document.StyleOverrideKey{
						document.OverrideBackground,
					},
				},
			},
			Defaults: []document.StyleDefault{{BlockKind: document.BlockKindText, StyleID: "body-callout"}},
		},
		Rows: []document.Row{{
			Blocks: []document.Block{{
				Kind: document.BlockKindText,
				StyleRef: &document.BlockStyleRef{
					StyleID: "body-callout",
					Overrides: document.StyleOverrides{
						Background: &background,
					},
				},
				Atoms: []document.Atom{{Text: "hello"}},
			}},
		}},
	}

	doc, err := d.Create("p", "Styled", base)
	if err != nil {
		t.Fatal(err)
	}
	got, err := d.Get("p", doc.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got.Base.StyleRegistry, doc.Base.StyleRegistry) {
		t.Fatalf("style registry round trip = %+v, want %+v", got.Base.StyleRegistry, doc.Base.StyleRegistry)
	}
	if got.Base.Rows[0].Blocks[0].StyleRef == nil ||
		got.Base.Rows[0].Blocks[0].StyleRef.StyleID != "body-callout" ||
		got.Base.Rows[0].Blocks[0].StyleRef.Overrides.Background == nil ||
		*got.Base.Rows[0].Blocks[0].StyleRef.Overrides.Background != document.BackgroundMuted {
		t.Fatalf("style ref round trip = %+v", got.Base.Rows[0].Blocks[0].StyleRef)
	}
}

func TestGetLegacyDocumentWithoutStyleState(t *testing.T) {
	store := document.NewMemoryStore()
	now := time.Unix(1, 0).UTC()
	legacy := document.Document{
		ID:        "legacy-doc",
		ProjectID: "p",
		Name:      "Legacy",
		Base: document.Base{Rows: []document.Row{{
			ID: "r1",
			Blocks: []document.Block{{
				ID:    "b1",
				Kind:  document.BlockKindText,
				Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "legacy"}},
			}},
		}}},
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := store.CreateDocument(legacy, document.ActivityFact{}); err != nil {
		t.Fatal(err)
	}
	docs := document.New(store, document.Options{})
	got, err := docs.Get("p", legacy.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Base.StyleRegistry.Definitions) != 0 || len(got.Base.StyleRegistry.Defaults) != 0 {
		t.Fatalf("legacy style registry = %+v, want empty", got.Base.StyleRegistry)
	}
	if got.Base.Rows[0].Blocks[0].StyleRef != nil {
		t.Fatalf("legacy style ref = %+v, want nil", got.Base.Rows[0].Blocks[0].StyleRef)
	}
}

func TestDuplicateGeneratesFreshIDs(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	src, err := docs.Create("projA", "Original", document.Base{
		Rows: []document.Row{{
			ID: "r1",
			Blocks: []document.Block{{
				ID: "b1", Kind: document.BlockKindText,
				Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "hello"}},
			}},
		}},
	}, actor)
	if err != nil {
		t.Fatal(err)
	}

	dup, err := docs.Duplicate("projA", src.ID, actor)
	if err != nil {
		t.Fatalf("Duplicate: %v", err)
	}

	if dup.ID == src.ID {
		t.Fatal("duplicate document ID not regenerated")
	}
	if dup.Name != "Original (1)" {
		t.Fatalf("duplicate name: got %q, want %q", dup.Name, "Original (1)")
	}
	if dup.Lifecycle != document.LifecycleActive {
		t.Fatalf("duplicate lifecycle: got %q", dup.Lifecycle)
	}
	if dup.Revision != 0 {
		t.Fatalf("duplicate revision: got %d, want 0", dup.Revision)
	}

	origRows := src.Base.Rows
	dupRows := dup.Base.Rows
	if len(dupRows) != len(origRows) {
		t.Fatalf("row count: %d, want %d", len(dupRows), len(origRows))
	}
	if dupRows[0].ID == origRows[0].ID {
		t.Fatal("row ID not regenerated")
	}
	dupBlock := dupRows[0].Blocks[0]
	origBlock := origRows[0].Blocks[0]
	if dupBlock.ID == origBlock.ID {
		t.Fatal("block ID not regenerated")
	}
	if dupBlock.Atoms[0].ID == origBlock.Atoms[0].ID {
		t.Fatal("atom ID not regenerated")
	}
	if dupBlock.Atoms[0].Text != "hello" {
		t.Fatal("atom text not preserved")
	}
}

func TestDuplicatePreservesStyleReferences(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	registry := document.StyleRegistry{
		Definitions: []document.StyleDefinition{
			{ID: "style-1", Name: "Heading Style", AppliesTo: []string{document.BlockKindText}},
		},
	}
	src, err := docs.Create("projA", "Styled Doc", document.Base{
		StyleRegistry: registry,
		Rows: []document.Row{{
			ID: "r1",
			Blocks: []document.Block{{
				ID: "b1", Kind: document.BlockKindText, SubKind: document.SubKindHeading1,
				StyleRef: &document.BlockStyleRef{StyleID: "style-1"},
				Atoms:    []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "Title"}},
			}},
		}},
	}, actor)
	if err != nil {
		t.Fatal(err)
	}

	dup, _ := docs.Duplicate("projA", src.ID, actor)
	if len(dup.Base.StyleRegistry.Definitions) != 1 {
		t.Fatalf("style registry: %d definitions, want 1", len(dup.Base.StyleRegistry.Definitions))
	}
	dupDef := dup.Base.StyleRegistry.Definitions[0]
	origDef := src.Base.StyleRegistry.Definitions[0]
	if dupDef.ID == origDef.ID {
		t.Fatal("style definition ID not regenerated")
	}
	if dupDef.Name != "Heading Style" {
		t.Fatal("style definition name not preserved")
	}

	dupRef := dup.Base.Rows[0].Blocks[0].StyleRef
	if dupRef == nil || dupRef.StyleID != dupDef.ID {
		t.Fatalf("StyleRef not remapped: got %v, want StyleID %s", dupRef, dupDef.ID)
	}
}

func TestDuplicatePreservesMarksWithRemappedAnchors(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	src, err := docs.Create("projA", "Marked", document.Base{
		Rows: []document.Row{{
			ID: "r1",
			Blocks: []document.Block{{
				ID: "b1", Kind: document.BlockKindText,
				Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "bold text"}},
				Marks: []document.Mark{{
					ID:    "m1",
					Kind:  document.MarkKindBold,
					Start: document.Anchor{AtomID: "a1", Offset: 0},
					End:   document.Anchor{AtomID: "a1", Offset: 4},
				}},
			}},
		}},
	}, actor)
	if err != nil {
		t.Fatal(err)
	}

	dup, err := docs.Duplicate("projA", src.ID, actor)
	if err != nil {
		t.Fatalf("Duplicate: %v", err)
	}

	dupBlock := dup.Base.Rows[0].Blocks[0]
	if len(dupBlock.Marks) != 1 {
		t.Fatalf("marks: %d, want 1", len(dupBlock.Marks))
	}
	dupMark := dupBlock.Marks[0]
	if dupMark.ID == "m1" {
		t.Fatal("mark ID not regenerated")
	}
	if dupMark.Kind != document.MarkKindBold {
		t.Fatal("mark kind not preserved")
	}
	if dupMark.Start.AtomID == "a1" {
		t.Fatal("mark anchor atom ID not remapped")
	}
	if dupMark.Start.AtomID != dupBlock.Atoms[0].ID {
		t.Fatalf("mark Start.AtomID %s does not match atom %s", dupMark.Start.AtomID, dupBlock.Atoms[0].ID)
	}
	if dupMark.End.AtomID != dupBlock.Atoms[0].ID {
		t.Fatalf("mark End.AtomID %s does not match atom %s", dupMark.End.AtomID, dupBlock.Atoms[0].ID)
	}
}

func TestDuplicateNameDedupScopedToProject(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	src, _ := docs.Create("projA", "Report", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText}}}}}, actor)

	dup1, _ := docs.Duplicate("projA", src.ID, actor)
	if dup1.Name != "Report (1)" {
		t.Fatalf("first duplicate: got %q, want %q", dup1.Name, "Report (1)")
	}

	dup2, _ := docs.Duplicate("projA", src.ID, actor)
	if dup2.Name != "Report (2)" {
		t.Fatalf("second duplicate: got %q, want %q", dup2.Name, "Report (2)")
	}

	_, err := docs.Duplicate("projB", src.ID, actor)
	if !errors.Is(err, document.ErrNotFound) {
		t.Fatalf("cross-project duplicate: got %v, want ErrNotFound", err)
	}
}

func TestDuplicateActivityFact(t *testing.T) {
	store := document.NewMemoryStore()
	docs := document.New(store, document.Options{})
	actor := document.Actor{ID: "u1", Name: "Ada"}
	src, _ := docs.Create("projA", "Source", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText}}}}}, actor)

	_, err := docs.Duplicate("projA", src.ID, actor)
	if err != nil {
		t.Fatal(err)
	}

	facts := store.ActivityFacts()
	if len(facts) != 2 {
		t.Fatalf("expected 2 facts (create + duplicate), got %d", len(facts))
	}
	dupFact := facts[1]
	if dupFact.Action != document.ActivityDuplicated {
		t.Fatalf("duplicate action: got %q, want %q", dupFact.Action, document.ActivityDuplicated)
	}
	if dupFact.SourceKind != "document.duplicate" {
		t.Fatalf("duplicate sourceKind: got %q", dupFact.SourceKind)
	}
	if dupFact.SourceID != src.ID {
		t.Fatalf("duplicate sourceID: got %q, want %q", dupFact.SourceID, src.ID)
	}
	if dupFact.TargetID == src.ID {
		t.Fatal("duplicate targetID should be the new document, not the source")
	}
}

func TestDuplicatePreservesFormulaData(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	src, err := docs.Create("projA", "Formula Doc", document.Base{
		Rows: []document.Row{{
			ID: "r1",
			Blocks: []document.Block{{
				ID: "b1", Kind: document.BlockKindText,
				Atoms: []document.Atom{{
					ID: "a1", Kind: document.AtomKindFormula,
					Data: document.FormulaData{
						Expression: "=SUM(A1:A10)",
						Dependencies: []document.FormulaDep{
							{NameID: "myrange"},
						},
					},
				}},
			}},
		}},
	}, actor)
	if err != nil {
		t.Fatal(err)
	}

	dup, err := docs.Duplicate("projA", src.ID, actor)
	if err != nil {
		t.Fatalf("Duplicate: %v", err)
	}

	dupAtom := dup.Base.Rows[0].Blocks[0].Atoms[0]
	fd, ok := dupAtom.Data.(document.FormulaData)
	if !ok {
		t.Fatalf("formula data not preserved: %T", dupAtom.Data)
	}
	if fd.Expression != "=SUM(A1:A10)" {
		t.Fatalf("formula expression: got %q", fd.Expression)
	}
	if len(fd.Dependencies) != 1 || fd.Dependencies[0].NameID != "myrange" {
		t.Fatalf("formula dependencies: %+v", fd.Dependencies)
	}
}

func TestDuplicatePreservesHeaderFooter(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	blk := func(id, text string) document.Block {
		return document.Block{
			ID:   id,
			Kind: document.BlockKindText,
			Style: document.BlockStyle{
				HorizontalAlign: document.HorizontalAlignLeft,
				VerticalAlign:   document.VerticalAlignTop,
			},
			Atoms: []document.Atom{{ID: id + "a", Kind: document.AtomKindText, Text: text}},
		}
	}
	src, err := docs.Create("projA", "Layout Doc", document.Base{
		Header: []document.Row{{ID: "hr1", Blocks: []document.Block{blk("hb1", "Header")}}},
		Footer: []document.Row{{ID: "fr1", Blocks: []document.Block{blk("fb1", "Footer")}}},
		Rows:   []document.Row{{ID: "r1", Blocks: []document.Block{blk("b1", "Body")}}},
	}, actor)
	if err != nil {
		t.Fatal(err)
	}

	dup, _ := docs.Duplicate("projA", src.ID, actor)
	if len(dup.Base.Header) != 1 {
		t.Fatal("header not preserved")
	}
	if dup.Base.Header[0].ID == "hr1" {
		t.Fatal("header row ID not regenerated")
	}
	if dup.Base.Header[0].Blocks[0].Atoms[0].Text != "Header" {
		t.Fatal("header content lost")
	}

	if len(dup.Base.Footer) != 1 {
		t.Fatal("footer not preserved")
	}
	if dup.Base.Footer[0].ID == "fr1" {
		t.Fatal("footer row ID not regenerated")
	}
	if dup.Base.Footer[0].Blocks[0].Atoms[0].Text != "Footer" {
		t.Fatal("footer content lost")
	}

	if dup.Base.Rows[0].Blocks[0].Atoms[0].Text != "Body" {
		t.Fatal("body content lost")
	}
}

func TestDuplicateMultipleRowsAndBlocks(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	src, _ := docs.Create("projA", "Multi", document.Base{
		Rows: []document.Row{
			{ID: "r1", Blocks: []document.Block{
				{ID: "b1a", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1a", Kind: document.AtomKindText, Text: "first"}, {ID: "a1b", Kind: document.AtomKindText, Text: "second"}}},
			}},
			{ID: "r2", Blocks: []document.Block{
				{ID: "b2a", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a2a", Kind: document.AtomKindText, Text: "row2"}}},
				{ID: "b2b", Kind: document.BlockKindDivider},
			}},
		},
	}, actor)

	dup, _ := docs.Duplicate("projA", src.ID, actor)
	if len(dup.Base.Rows) != 2 {
		t.Fatalf("rows: %d, want 2", len(dup.Base.Rows))
	}
	ids := map[string]bool{}
	for _, r := range dup.Base.Rows {
		if ids[r.ID] {
			t.Fatalf("duplicate row ID: %s", r.ID)
		}
		ids[r.ID] = true
		for _, b := range r.Blocks {
			if ids[b.ID] {
				t.Fatalf("duplicate block ID: %s", b.ID)
			}
			ids[b.ID] = true
			for _, a := range b.Atoms {
				if ids[a.ID] {
					t.Fatalf("duplicate atom ID: %s", a.ID)
				}
				ids[a.ID] = true
			}
		}
	}
}

func TestDuplicatePreservesPromptData(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	now := time.Now()
	src, _ := docs.Create("projA", "Prompt", document.Base{
		Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{
			ID: "b1", Kind: document.BlockKindPrompt,
			Style: document.BlockStyle{HorizontalAlign: document.HorizontalAlignLeft, VerticalAlign: document.VerticalAlignTop},
			Data: document.PromptData{
				Instruction: "Summarize the following:",
				Status:      "resolved",
				LastOutput:  "A summary of the content.",
				ResolvedAt:  now,
				OutputHistory: []document.PromptOutputRevision{{
					ID:        "rev-1",
					CreatedAt: now,
					Atoms:     []document.Atom{{Kind: document.AtomKindText, Text: "summary"}},
				}},
			},
		}}}},
	}, actor)

	dup, _ := docs.Duplicate("projA", src.ID, actor)
	dupBlock := dup.Base.Rows[0].Blocks[0]
	pd, ok := dupBlock.Data.(document.PromptData)
	if !ok {
		t.Fatalf("PromptData not preserved: %T", dupBlock.Data)
	}
	if pd.Instruction != "Summarize the following:" {
		t.Fatalf("instruction: got %q", pd.Instruction)
	}
	if pd.LastOutput != "A summary of the content." {
		t.Fatalf("lastOutput: got %q", pd.LastOutput)
	}
	if len(pd.OutputHistory) != 1 || pd.OutputHistory[0].ID != "rev-1" {
		t.Fatalf("outputHistory: %+v", pd.OutputHistory)
	}
}

func TestDuplicatePreservesImageData(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	src, _ := docs.Create("projA", "Image", document.Base{
		Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{
			ID:    "b1",
			Kind:  document.BlockKindImage,
			Style: document.BlockStyle{HorizontalAlign: document.HorizontalAlignLeft, VerticalAlign: document.VerticalAlignTop},
			Data:  document.ImageData{FileID: "file-1", Alt: "alt text", Width: 800, Height: 600},
		}}}},
	}, actor)

	dup, _ := docs.Duplicate("projA", src.ID, actor)
	img, ok := dup.Base.Rows[0].Blocks[0].Data.(document.ImageData)
	if !ok {
		t.Fatalf("ImageData not preserved: %T", dup.Base.Rows[0].Blocks[0].Data)
	}
	if img.FileID != "file-1" || img.Alt != "alt text" || img.Width != 800 || img.Height != 600 {
		t.Fatalf("ImageData: %+v", img)
	}
}

func TestDuplicatePreservesStyleDefaults(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	registry := document.StyleRegistry{
		Definitions: []document.StyleDefinition{
			{ID: "s1", Name: "Body", AppliesTo: []string{document.BlockKindText}},
			{ID: "s2", Name: "Code", AppliesTo: []string{document.BlockKindCode}},
		},
		Defaults: []document.StyleDefault{
			{BlockKind: document.BlockKindText, StyleID: "s1"},
			{BlockKind: document.BlockKindCode, StyleID: "s2"},
		},
	}
	src, _ := docs.Create("projA", "Style Defaults", document.Base{
		StyleRegistry: registry,
		Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{
			ID: "b1", Kind: document.BlockKindText,
			Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "text"}},
		}}}},
	}, actor)

	dup, _ := docs.Duplicate("projA", src.ID, actor)
	if len(dup.Base.StyleRegistry.Defaults) != 2 {
		t.Fatalf("defaults: %d, want 2", len(dup.Base.StyleRegistry.Defaults))
	}
	for _, d := range dup.Base.StyleRegistry.Defaults {
		if d.StyleID == "s1" || d.StyleID == "s2" {
			t.Fatalf("default StyleID not remapped: %s", d.StyleID)
		}
		found := false
		for _, def := range dup.Base.StyleRegistry.Definitions {
			if def.ID == d.StyleID {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("default StyleID %s not in definitions", d.StyleID)
		}
	}
}

func TestDuplicateTrashedDocument(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	src, _ := docs.Create("projA", "Trash Me", document.Base{
		Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "save me"}}}}}},
	}, actor)

	docs.Delete("projA", src.ID, actor)

	dup, err := docs.Duplicate("projA", src.ID, actor)
	if err != nil {
		t.Fatalf("Duplicate trashed: %v", err)
	}
	if dup.Lifecycle != document.LifecycleActive {
		t.Fatalf("duplicate lifecycle: got %q, want active", dup.Lifecycle)
	}
	if dup.Name != "Trash Me (1)" {
		t.Fatalf("name: got %q", dup.Name)
	}
}

func TestDuplicateNonExistent(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	_, err := docs.Duplicate("projA", "no-such-doc", actor)
	if !errors.Is(err, document.ErrNotFound) {
		t.Fatalf("duplicate non-existent: got %v, want ErrNotFound", err)
	}
}

func TestDuplicateAllBlockKinds(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	blk := func(id string, kind string, atoms ...document.Atom) document.Block {
		return document.Block{
			ID: id, Kind: kind,
			Style: document.BlockStyle{HorizontalAlign: document.HorizontalAlignLeft, VerticalAlign: document.VerticalAlignTop},
			Atoms: atoms,
		}
	}

	src, _ := docs.Create("projA", "All Kinds", document.Base{
		Rows: []document.Row{{ID: "r1", Blocks: []document.Block{
			blk("bp", document.BlockKindText, document.Atom{ID: "ap", Kind: document.AtomKindText, Text: "para"}),
			blk("bq", document.BlockKindText, document.Atom{ID: "aq", Kind: document.AtomKindText, Text: "quoted"}),
			blk("bc", document.BlockKindCode, document.Atom{ID: "ac", Kind: document.AtomKindText, Text: "code"}),
			blk("bd", document.BlockKindDivider),
			blk("bo", document.BlockKindText, document.Atom{ID: "ao", Kind: document.AtomKindText, Text: "note"}),
		}}},
	}, actor)

	dup, _ := docs.Duplicate("projA", src.ID, actor)
	blocks := dup.Base.Rows[0].Blocks
	if len(blocks) != 5 {
		t.Fatalf("block count: %d, want 5", len(blocks))
	}
	kinds := []string{blocks[0].Kind, blocks[1].Kind, blocks[2].Kind, blocks[3].Kind, blocks[4].Kind}
	expected := []string{document.BlockKindText, document.BlockKindText, document.BlockKindCode, document.BlockKindDivider, document.BlockKindText}
	for i, k := range kinds {
		if k != expected[i] {
			t.Fatalf("block %d kind: got %q, want %q", i, k, expected[i])
		}
	}
	if blocks[0].Atoms[0].Text != "para" {
		t.Fatalf("paragraph text lost")
	}
	if blocks[1].Atoms[0].Text != "quoted" {
		t.Fatalf("quote text lost")
	}
	if blocks[2].Atoms[0].Text != "code" {
		t.Fatalf("code text lost")
	}
	if len(blocks[3].Atoms) != 0 {
		t.Fatalf("divider has atoms: %d", len(blocks[3].Atoms))
	}
	if blocks[4].Atoms[0].Text != "note" {
		t.Fatalf("callout text lost")
	}
}

func TestDuplicatePreservesFormulaHistory(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	src, _ := docs.Create("projA", "Formula History", document.Base{
		Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{
			ID: "b1", Kind: document.BlockKindText,
			Style: document.BlockStyle{HorizontalAlign: document.HorizontalAlignLeft, VerticalAlign: document.VerticalAlignTop},
			Atoms: []document.Atom{{
				ID: "a1", Kind: document.AtomKindFormula,
				Data: document.FormulaData{
					Expression: "=1+1",
					Result:     document.FormulaResult{Value: "2", Type: "number"},
					History: []document.FormulaHistoryEntry{
						{Result: document.FormulaResult{Value: "2", Type: "number"}, EvaluatedAt: time.Now()},
					},
				},
			}},
		}}}},
	}, actor)

	dup, _ := docs.Duplicate("projA", src.ID, actor)
	fd, ok := dup.Base.Rows[0].Blocks[0].Atoms[0].Data.(document.FormulaData)
	if !ok {
		t.Fatalf("FormulaData: %T", dup.Base.Rows[0].Blocks[0].Atoms[0].Data)
	}
	if fd.Expression != "=1+1" {
		t.Fatalf("expression: got %q", fd.Expression)
	}
	if fd.Result.Value != "2" {
		t.Fatalf("result: %+v", fd.Result)
	}
	if len(fd.History) != 1 || fd.History[0].Result.Value != "2" {
		t.Fatalf("history: %+v", fd.History)
	}
}

func TestDuplicateUsesSourceIDAsProvenance(t *testing.T) {
	store := document.NewMemoryStore()
	docs := document.New(store, document.Options{})
	actor := document.Actor{ID: "u1", Name: "Ada"}
	src, _ := docs.Create("projA", "Source", document.Base{
		Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText}}}},
	}, actor)
	dup, _ := docs.Duplicate("projA", src.ID, actor)

	facts := store.ActivityFacts()
	dupFact := facts[1]
	if dupFact.SourceID != src.ID {
		t.Fatalf("sourceID: got %q, want %q (the original document)", dupFact.SourceID, src.ID)
	}
	if dupFact.TargetID == src.ID {
		t.Fatalf("targetID %q should differ from source %q", dupFact.TargetID, src.ID)
	}
	if dupFact.TargetID != dup.ID {
		t.Fatalf("targetID %q should match duplicate %q", dupFact.TargetID, dup.ID)
	}
}

func TestDiffIdenticalRevisions(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	doc, _ := docs.Create("projA", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "hello"}}}}}}}, actor)

	result, err := docs.Diff("projA", doc.ID, 0, 0, document.DiffBounds{})
	if err == nil {
		t.Fatal("expected error for equal revisions")
	}
	_ = result
}

func TestDiffAddedRow(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	doc, _ := docs.Create("projA", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "hello"}}}}}}}, actor)

	submitChanges(docs, "projA", doc.ID, actor.ID, []document.ChangeOp{{
		Op: document.OpInsertRow, AfterRow: "r1",
		Row: &document.Row{ID: "r2", Blocks: []document.Block{{ID: "b2", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "world"}}}}},
	}}, actor.Name)

	result, err := docs.Diff("projA", doc.ID, 0, 1, document.DiffBounds{MaxChanges: 50})
	if err != nil {
		t.Fatalf("Diff: %v", err)
	}
	if len(result.Changes) != 3 {
		t.Fatalf("changes: %d, want 3 (row + block + atom)", len(result.Changes))
	}
	if result.Changes[0].Kind != "added" || result.Changes[0].Level != "row" || result.Changes[0].ID != "r2" {
		t.Fatalf("first change: %+v", result.Changes[0])
	}
}

func TestDiffChangedAtomText(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	doc, _ := docs.Create("projA", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "draft"}}}}}}}, actor)

	updated := "final"
	submitChanges(docs, "projA", doc.ID, actor.ID, []document.ChangeOp{{
		Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: &updated,
	}}, actor.Name)

	result, err := docs.Diff("projA", doc.ID, 0, 1, document.DiffBounds{MaxChanges: 50})
	if err != nil {
		t.Fatalf("Diff: %v", err)
	}
	if len(result.Changes) != 1 {
		t.Fatalf("changes: %d, want 1", len(result.Changes))
	}
	ch := result.Changes[0]
	if ch.Kind != "content-changed" || ch.Level != "atom" || ch.ID != "a1" {
		t.Fatalf("change: %+v", ch)
	}
	if ch.OldText != "draft" || ch.NewText != "final" {
		t.Fatalf("text: old=%q new=%q", ch.OldText, ch.NewText)
	}
}

func TestDiffRemovedRow(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	doc, _ := docs.Create("projA", "Doc", document.Base{Rows: []document.Row{
		{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "keep"}}}}},
		{ID: "r2", Blocks: []document.Block{{ID: "b2", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "remove"}}}}},
	}}, actor)

	submitChanges(docs, "projA", doc.ID, actor.ID, []document.ChangeOp{{
		Op: document.OpDeleteRow, RowID: "r2",
	}}, actor.Name)

	result, err := docs.Diff("projA", doc.ID, 0, 1, document.DiffBounds{MaxChanges: 50})
	if err != nil {
		t.Fatalf("Diff: %v", err)
	}
	if len(result.Changes) != 1 {
		t.Fatalf("changes: %d, want 1", len(result.Changes))
	}
	if result.Changes[0].Kind != "removed" || result.Changes[0].Level != "row" || result.Changes[0].ID != "r2" {
		t.Fatalf("change: %+v", result.Changes[0])
	}
}

func TestDiffBounds(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	doc, _ := docs.Create("projA", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "hello"}}}}}}}, actor)

	submitChanges(docs, "projA", doc.ID, actor.ID, []document.ChangeOp{{
		Op: document.OpInsertRow, AfterRow: "r1",
		Row: &document.Row{ID: "r2", Blocks: []document.Block{{ID: "b2", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "world"}}}}},
	}}, actor.Name)

	result, err := docs.Diff("projA", doc.ID, 0, 1, document.DiffBounds{MaxChanges: 1})
	if err != nil {
		t.Fatalf("Diff: %v", err)
	}
	if !result.Truncated {
		t.Fatal("expected truncated=true with MaxChanges=1 on a 3-change diff")
	}
	if len(result.Changes) != 1 {
		t.Fatalf("changes: %d, want 1 (bounded)", len(result.Changes))
	}
}

func TestDiffInvalidRevisions(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	doc, _ := docs.Create("projA", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "hello"}}}}}}}, actor)

	_, err := docs.Diff("projA", doc.ID, 5, 3, document.DiffBounds{})
	if !errors.Is(err, document.ErrInvalidDiffRevisions) {
		t.Fatalf("inverted revisions: got %v, want ErrInvalidDiffRevisions", err)
	}

	_, err = docs.Diff("projA", doc.ID, 3, 3, document.DiffBounds{})
	if !errors.Is(err, document.ErrInvalidDiffRevisions) {
		t.Fatalf("equal revisions: got %v, want ErrInvalidDiffRevisions", err)
	}
}

func TestDiffTextCapping(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	doc, _ := docs.Create("projA", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "short"}}}}}}}, actor)

	long := "this is a fairly long string that should be capped by the max text length setting in the diff bounds"
	submitChanges(docs, "projA", doc.ID, actor.ID, []document.ChangeOp{{
		Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: &long,
	}}, actor.Name)

	result, err := docs.Diff("projA", doc.ID, 0, 1, document.DiffBounds{MaxTextLen: 10})
	if err != nil {
		t.Fatalf("Diff: %v", err)
	}
	ch := result.Changes[0]
	if ch.OldText == "short" && strings.Contains(ch.NewText, "...") {
		// old text fits, new text capped
	} else if len(ch.NewText) > 10 && !strings.Contains(ch.NewText, "...") {
		t.Fatalf("expected capped text, got old=%q new=%q", ch.OldText, ch.NewText)
	}
}

func TestDiffUndoReturnsToOriginal(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	doc, _ := docs.Create("projA", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "draft"}}}}}}}, actor)

	updated := "changed"
	cs, _ := submitChanges(docs, "projA", doc.ID, actor.ID, []document.ChangeOp{{
		Op: document.OpSetAtomText, BlockID: "b1", AtomID: "a1", SetText: &updated,
	}}, actor.Name)
	docs.Undo("projA", doc.ID, actor.ID, cs.ID, actor.Name)

	result, err := docs.Diff("projA", doc.ID, 0, 2, document.DiffBounds{})
	if err != nil {
		t.Fatalf("Diff: %v", err)
	}
	// After undo, rev2 content matches rev0 — no net change.
	if len(result.Changes) != 0 {
		t.Fatalf("expected 0 changes after undo returns to original, got %d: %+v", len(result.Changes), result.Changes)
	}
}

func TestCreateAnchorAndList(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	doc, _ := docs.Create("projA", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "hello"}}}}}}}, actor)

	a, err := docs.CreateAnchor("projA", doc.ID, document.DocumentAnchor{
		RowID: "r1", BlockID: "b1", AtomID: "a1", Start: 0, End: 5,
	})
	if err != nil {
		t.Fatalf("CreateAnchor: %v", err)
	}
	if a.ID == "" || a.State != document.AnchorValid {
		t.Fatalf("anchor: id=%q state=%q", a.ID, a.State)
	}

	list, err := docs.ListAnchors("projA", doc.ID)
	if err != nil {
		t.Fatalf("ListAnchors: %v", err)
	}
	if len(list) != 1 || list[0].ID != a.ID {
		t.Fatalf("list: %+v", list)
	}
}

func TestCreateAnchorInvalidTarget(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	doc, _ := docs.Create("projA", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "hello"}}}}}}}, actor)

	_, err := docs.CreateAnchor("projA", doc.ID, document.DocumentAnchor{
		RowID: "r1", BlockID: "nonexistent",
	})
	if !errors.Is(err, document.ErrAnchorInvalid) {
		t.Fatalf("invalid target: got %v, want ErrAnchorInvalid", err)
	}
}

func TestAnchorValidateAndOrphan(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	doc, _ := docs.Create("projA", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "hello"}}}}}}}, actor)

	_, _ = docs.CreateAnchor("projA", doc.ID, document.DocumentAnchor{
		RowID: "r1", BlockID: "b1",
	})

	// Delete the block — the anchor should be orphaned after rebase.
	submitChanges(docs, "projA", doc.ID, actor.ID, []document.ChangeOp{{
		Op: document.OpDeleteBlock, BlockID: "b1",
	}}, actor.Name)

	list, err := docs.ListAnchors("projA", doc.ID)
	if err != nil {
		t.Fatalf("ListAnchors: %v", err)
	}
	if len(list) != 1 || list[0].State != document.AnchorOrphaned {
		t.Fatalf("expected orphaned anchor, got %+v", list)
	}
}

func TestAnchorMoveBlockRebase(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	doc, _ := docs.Create("projA", "Doc", document.Base{
		Rows: []document.Row{
			{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "first"}}}}},
			{ID: "r2", Blocks: []document.Block{{ID: "b2", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "second"}}}}},
		},
	}, actor)

	_, _ = docs.CreateAnchor("projA", doc.ID, document.DocumentAnchor{
		RowID: "r1", BlockID: "b1",
	})

	// Move block b1 to row r2
	_, err := submitChanges(docs, "projA", doc.ID, actor.ID, []document.ChangeOp{{
		Op: document.OpMoveBlock, BlockID: "b1", FromRowID: "r1", RowID: "r2", AfterBlock: "b2",
	}}, actor.Name)
	if err != nil {
		t.Fatalf("submitChanges: %v", err)
	}

	list, _ := docs.ListAnchors("projA", doc.ID)
	if list[0].RowID != "r2" {
		t.Fatalf("anchor RowID not rebased: got %q, want %q", list[0].RowID, "r2")
	}
	if list[0].State != document.AnchorValid {
		t.Fatalf("anchor should still be valid after move: %s", list[0].State)
	}
}

func TestDeleteAnchor(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	doc, _ := docs.Create("projA", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "hello"}}}}}}}, actor)

	a, _ := docs.CreateAnchor("projA", doc.ID, document.DocumentAnchor{
		RowID: "r1", BlockID: "b1",
	})

	if err := docs.DeleteAnchor("projA", doc.ID, a.ID); err != nil {
		t.Fatalf("DeleteAnchor: %v", err)
	}

	list, _ := docs.ListAnchors("projA", doc.ID)
	if len(list) != 0 {
		t.Fatalf("expected 0 anchors after delete, got %d", len(list))
	}
}

func TestAnchorValidateEndpoint(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	doc, _ := docs.Create("projA", "Doc", document.Base{Rows: []document.Row{{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "hello"}}}}}}}, actor)

	a, _ := docs.CreateAnchor("projA", doc.ID, document.DocumentAnchor{
		RowID: "r1", BlockID: "b1",
	})

	validated, err := docs.ValidateAnchor("projA", doc.ID, a.ID)
	if err != nil {
		t.Fatalf("ValidateAnchor: %v", err)
	}
	if validated.State != document.AnchorValid {
		t.Fatalf("expected valid after validate, got %s", validated.State)
	}

	// Delete the target, then validate.
	_, err = submitChanges(docs, "projA", doc.ID, actor.ID, []document.ChangeOp{{
		Op: document.OpDeleteBlock, BlockID: "b1",
	}}, actor.Name)
	if err != nil {
		t.Fatalf("submitChanges: %v", err)
	}

	validated, err = docs.ValidateAnchor("projA", doc.ID, a.ID)
	if err != nil {
		t.Fatalf("ValidateAnchor after delete: %v", err)
	}
	if validated.State != document.AnchorOrphaned {
		t.Fatalf("expected orphaned after target deleted, got %s", validated.State)
	}
}

func TestCreateSetsCreator(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	doc, err := docs.Create("projA", "Test", document.Base{Rows: []document.Row{{
		ID: "r1", Blocks: []document.Block{{
			ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{
				ID: "a1", Kind: document.AtomKindText, Text: "hello",
			}},
		}},
	}}}, actor)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if doc.CreatorID != "u1" {
		t.Fatalf("expected creator ID u1, got %q", doc.CreatorID)
	}
	if doc.CreatorName != "Ada" {
		t.Fatalf("expected creator name Ada, got %q", doc.CreatorName)
	}

	got, err := docs.Get("projA", doc.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.CreatorID != "u1" || got.CreatorName != "Ada" {
		t.Fatalf("get creator: %q / %q", got.CreatorID, got.CreatorName)
	}

	list, err := docs.List("projA")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 1 || list[0].CreatorID != "u1" || list[0].CreatorName != "Ada" {
		t.Fatalf("list creator: %q / %q", list[0].CreatorID, list[0].CreatorName)
	}

	sums, err := docs.Summaries("projA", nil, 10)
	if err != nil {
		t.Fatalf("Summaries: %v", err)
	}
	if len(sums) != 1 || sums[0].CreatorID != "u1" || sums[0].CreatorName != "Ada" {
		t.Fatalf("summary creator: %q / %q", sums[0].CreatorID, sums[0].CreatorName)
	}
}

func TestDuplicateSetsCreator(t *testing.T) {
	docs := newDocs()
	actor := document.Actor{ID: "u1", Name: "Ada"}
	src, _ := docs.Create("projA", "Original", document.Base{Rows: []document.Row{{
		ID: "r1", Blocks: []document.Block{{
			ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{
				ID: "a1", Kind: document.AtomKindText, Text: "hello",
			}},
		}},
	}}}, actor)

	dup, err := docs.Duplicate("projA", src.ID, actor)
	if err != nil {
		t.Fatalf("Duplicate: %v", err)
	}
	if dup.CreatorID != "u1" {
		t.Fatalf("duplicate creator ID: got %q, want u1", dup.CreatorID)
	}
	if dup.CreatorName != "Ada" {
		t.Fatalf("duplicate creator name: got %q, want Ada", dup.CreatorName)
	}
	if dup.CreatorID == src.CreatorID && dup.CreatorName == src.CreatorName {
		// correct — duplicate sets creator from dup actor, which happens to be
		// the same actor as the source in this test. Now test with different actor.
	}
	different := document.Actor{ID: "u2", Name: "Rob"}
	dup2, err := docs.Duplicate("projA", src.ID, different)
	if err != nil {
		t.Fatalf("Duplicate with different actor: %v", err)
	}
	if dup2.CreatorID != "u2" {
		t.Fatalf("duplicate creator ID from different actor: got %q, want u2", dup2.CreatorID)
	}
	if dup2.CreatorName != "Rob" {
		t.Fatalf("duplicate creator name from different actor: got %q, want Rob", dup2.CreatorName)
	}
}

func TestCreateSystemActorFallback(t *testing.T) {
	docs := newDocs()
	doc, err := docs.Create("projA", "Test", document.Base{Rows: []document.Row{{
		ID: "r1", Blocks: []document.Block{{
			ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{
				ID: "a1", Kind: document.AtomKindText, Text: "hello",
			}},
		}},
	}}})
	if err != nil {
		t.Fatalf("Create (no actor): %v", err)
	}
	if doc.CreatorID != "system" {
		t.Fatalf("expected SystemActor ID 'system', got %q", doc.CreatorID)
	}
	if doc.CreatorName != "Taurus" {
		t.Fatalf("expected SystemActor name 'Taurus', got %q", doc.CreatorName)
	}
}

func TestCreateEmptyActorIDFallsBackToSystem(t *testing.T) {
	docs := newDocs()
	doc, err := docs.Create("projA", "Test", document.Base{Rows: []document.Row{{
		ID: "r1", Blocks: []document.Block{{
			ID: "b1", Kind: document.BlockKindText, Atoms: []document.Atom{{
				ID: "a1", Kind: document.AtomKindText, Text: "hello",
			}},
		}},
	}}}, document.Actor{ID: "", Name: "Ada"})
	if err != nil {
		t.Fatalf("Create (empty ID): %v", err)
	}
	if doc.CreatorID != "system" {
		t.Fatalf("expected fallback SystemActor for empty ID, got %q", doc.CreatorID)
	}
}

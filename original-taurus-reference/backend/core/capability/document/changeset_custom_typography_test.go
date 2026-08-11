package document_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

// TestCustomTypographyDoesNotFreezeStyleRegistry is a regression test: a
// custom-typography-only block (no assigned style, empty StyleID) must not make
// validStyleSystem false and lock out every registry-editing op.
func TestCustomTypographyDoesNotFreezeStyleRegistry(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", oneAtomDoc("hello"))

	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetBlockCustomTypography, BlockID: "b1", CustomTypography: &document.CustomTypography{FontSize: "14px"}},
	}); err != nil {
		t.Fatalf("set custom typography: %v", err)
	}
	// A registry op must still succeed with a custom-only block present.
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpPutStyleDefinition, Style: &document.StyleDefinition{
			ID: "body", Name: "Body", AppliesTo: []string{document.BlockKindText},
			Typography: document.TypographyBody, Spacing: document.SpacingRelaxed,
			Padding: document.PaddingNormal, Border: document.BorderSubtle,
			Background: document.BackgroundSubtle, Tone: document.ToneAccent,
		}},
	}); err != nil {
		t.Fatalf("registry op must still work with a custom-only block: %v", err)
	}
}

// TestCustomTypographyConcurrentStyleOverridesConflict is a regression test: a
// stale set_block_style_overrides (which replaces the whole Overrides, Custom
// included) must conflict with a committed set_block_custom_typography on the
// same block, not silently clobber it.
func TestCustomTypographyConcurrentStyleOverridesConflict(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", oneAtomDoc("hello"))

	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpPutStyleDefinition, Style: &document.StyleDefinition{
			ID: "s1", Name: "S1", AppliesTo: []string{document.BlockKindText},
			Typography: document.TypographyBody, Spacing: document.SpacingRelaxed,
			Padding: document.PaddingNormal, Border: document.BorderSubtle,
			Background: document.BackgroundSubtle, Tone: document.ToneAccent,
			AllowOverrides: []document.StyleOverrideKey{document.OverrideTypography},
		}},
		{Op: document.OpAssignBlockStyle, BlockID: "b1", StyleRef: &document.BlockStyleRef{StyleID: "s1"}},
	}); err != nil {
		t.Fatalf("setup: %v", err)
	}
	head, _ := docs.Get("p", doc.ID)
	baseRev := head.Revision

	// User B commits custom typography at the head.
	if _, err := docs.SubmitChanges("p", doc.ID, "u2", document.ChangeSubmission{
		SubmissionID: "B", ExpectedRevision: baseRev,
		Operations: []document.ChangeOp{{Op: document.OpSetBlockCustomTypography, BlockID: "b1", CustomTypography: &document.CustomTypography{Foreground: "red"}}},
	}); err != nil {
		t.Fatalf("B commit: %v", err)
	}

	// User A, stale at baseRev, submits set_block_style_overrides (no Custom): it
	// must be rejected as a revision conflict, not admitted and clobber B's edit.
	title := document.TypographyTitle
	_, err := docs.SubmitChanges("p", doc.ID, "u1", document.ChangeSubmission{
		SubmissionID: "A", ExpectedRevision: baseRev,
		Operations: []document.ChangeOp{{Op: document.OpSetBlockStyleOverrides, BlockID: "b1", StyleOverrides: &document.StyleOverrides{Typography: &title}}},
	})
	if !errors.Is(err, document.ErrRevisionConflict) {
		t.Fatalf("stale style-overrides over a custom-typography edit must conflict, got %v", err)
	}
	got, _ := docs.Get("p", doc.ID)
	if c := got.Base.Rows[0].Blocks[0].StyleRef.Overrides.Custom; c == nil || c.Foreground != "red" {
		t.Fatalf("B's custom typography was clobbered: %+v", got.Base.Rows[0].Blocks[0].StyleRef.Overrides)
	}
}

func customOf(t *testing.T, docs *document.Documents, docID string) *document.CustomTypography {
	t.Helper()
	got, err := docs.Get("p", docID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	ref := got.Base.Rows[0].Blocks[0].StyleRef
	if ref == nil {
		return nil
	}
	return ref.Overrides.Custom
}

func TestCustomTypographyStoresArbitraryValues(t *testing.T) {
	docs := newDocs()
	doc, err := docs.Create("p", "Doc", oneAtomDoc("hello"))
	if err != nil {
		t.Fatal(err)
	}

	// Arbitrary, non-semantic values on a block with no assigned style.
	_, err = submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetBlockCustomTypography, BlockID: "b1", CustomTypography: &document.CustomTypography{
			FontFamily: "Comic Sans MS", FontSize: "13.5pt", Foreground: "rgb(1, 2, 3)",
		}},
	})
	if err != nil {
		t.Fatalf("set custom typography: %v", err)
	}
	custom := customOf(t, docs, doc.ID)
	if custom == nil || custom.FontFamily != "Comic Sans MS" || custom.FontSize != "13.5pt" || custom.Foreground != "rgb(1, 2, 3)" {
		t.Fatalf("custom typography not stored verbatim: %+v", custom)
	}
	// A bare custom-typography ref carries no semantic style.
	got, _ := docs.Get("p", doc.ID)
	if got.Base.Rows[0].Blocks[0].StyleRef.StyleID != "" {
		t.Errorf("expected empty StyleID on a custom-only ref, got %q", got.Base.Rows[0].Blocks[0].StyleRef.StyleID)
	}
}

func TestCustomTypographyReplaceAndClear(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", oneAtomDoc("hello"))

	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetBlockCustomTypography, BlockID: "b1", CustomTypography: &document.CustomTypography{FontFamily: "Serif"}},
	}); err != nil {
		t.Fatalf("set: %v", err)
	}
	// Replace with a different value.
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetBlockCustomTypography, BlockID: "b1", CustomTypography: &document.CustomTypography{Foreground: "#ff0000"}},
	}); err != nil {
		t.Fatalf("replace: %v", err)
	}
	custom := customOf(t, docs, doc.ID)
	if custom == nil || custom.FontFamily != "" || custom.Foreground != "#ff0000" {
		t.Fatalf("replace did not swap the whole custom typography: %+v", custom)
	}
	// Clear: a nil payload removes it, and the bare ref collapses to nil.
	if _, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetBlockCustomTypography, BlockID: "b1", CustomTypography: nil},
	}); err != nil {
		t.Fatalf("clear: %v", err)
	}
	got, _ := docs.Get("p", doc.ID)
	if got.Base.Rows[0].Blocks[0].StyleRef != nil {
		t.Fatalf("cleared custom typography should collapse the ref, got %+v", got.Base.Rows[0].Blocks[0].StyleRef)
	}
}

func TestCustomTypographyUndoRedo(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", oneAtomDoc("hello"))

	cs, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetBlockCustomTypography, BlockID: "b1", CustomTypography: &document.CustomTypography{FontFamily: "Mono", FontSize: "12px"}},
	})
	if err != nil {
		t.Fatalf("set: %v", err)
	}
	undo, err := docs.Undo("p", doc.ID, "u1", cs.ID)
	if err != nil {
		t.Fatalf("undo: %v (inverse=%+v)", err, cs.InverseOps)
	}
	if c := customOf(t, docs, doc.ID); c != nil {
		t.Fatalf("undo should clear the custom typography, got %+v", c)
	}
	if _, err := docs.Redo("p", doc.ID, "u1", undo.ID); err != nil {
		t.Fatalf("redo: %v", err)
	}
	if c := customOf(t, docs, doc.ID); c == nil || c.FontFamily != "Mono" || c.FontSize != "12px" {
		t.Fatalf("redo should restore the custom typography, got %+v", c)
	}
}

func TestCustomTypographyCoexistsWithSemanticStyleUngated(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", oneAtomDoc("hello"))

	// A style that allows NO overrides — custom typography is still permitted,
	// because it is ungated by allowOverrides.
	_, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpPutStyleDefinition, Style: &document.StyleDefinition{
			ID: "plain", Name: "Plain", AppliesTo: []string{document.BlockKindText},
			Typography: document.TypographyBody, Spacing: document.SpacingRelaxed,
			Padding: document.PaddingNormal, Border: document.BorderSubtle,
			Background: document.BackgroundSubtle, Tone: document.ToneAccent,
		}},
		{Op: document.OpAssignBlockStyle, BlockID: "b1", StyleRef: &document.BlockStyleRef{StyleID: "plain"}},
		{Op: document.OpSetBlockCustomTypography, BlockID: "b1", CustomTypography: &document.CustomTypography{Foreground: "hotpink"}},
	})
	if err != nil {
		t.Fatalf("assign + custom: %v", err)
	}
	got, _ := docs.Get("p", doc.ID)
	ref := got.Base.Rows[0].Blocks[0].StyleRef
	if ref == nil || ref.StyleID != "plain" || ref.Overrides.Custom == nil || ref.Overrides.Custom.Foreground != "hotpink" {
		t.Fatalf("semantic style and custom typography should coexist: %+v", ref)
	}
}

func TestCustomTypographyLengthBoundRejected(t *testing.T) {
	docs := newDocs()
	doc, _ := docs.Create("p", "Doc", oneAtomDoc("hello"))

	_, err := submitChanges(docs, "p", doc.ID, "u1", []document.ChangeOp{
		{Op: document.OpSetBlockCustomTypography, BlockID: "b1", CustomTypography: &document.CustomTypography{
			FontFamily: strings.Repeat("x", 200),
		}},
	})
	if err == nil {
		t.Fatalf("an over-long font family should be rejected")
	}
}

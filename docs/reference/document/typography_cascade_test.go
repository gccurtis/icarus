package document_test

import (
	"errors"
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

func colorMark(id, value string) document.Mark {
	return document.Mark{
		ID: id, Kind: document.MarkKindFg, Attrs: map[string]string{"value": value},
		Start: document.Anchor{AtomID: "a1", Offset: 0}, End: document.Anchor{AtomID: "a1", Offset: 5},
	}
}

// font/color/background marks are accepted with valid attrs and rejected with
// invalid ones (bad color, no font attrs).
func TestTypographicMarks(t *testing.T) {
	d := newDocs()
	doc, err := d.Create("p", "Doc", oneAtomDoc("hello"))
	if err != nil {
		t.Fatal(err)
	}
	ok := []document.Mark{
		{ID: "m1", Kind: document.MarkKindFont, Attrs: map[string]string{"family": "Inter", "size": "14px"},
			Start: document.Anchor{AtomID: "a1", Offset: 0}, End: document.Anchor{AtomID: "a1", Offset: 5}},
		{ID: "m2", Kind: document.MarkKindBg, Attrs: map[string]string{"value": "rgb(255, 255, 0)"},
			Start: document.Anchor{AtomID: "a1", Offset: 0}, End: document.Anchor{AtomID: "a1", Offset: 5}},
	}
	for _, m := range ok {
		mark := m
		if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
			{Op: document.OpAddMark, BlockID: "b1", Mark: &mark},
		}); err != nil {
			t.Fatalf("add %s mark: %v", m.Kind, err)
		}
	}
	got, _ := d.Get("p", doc.ID)
	if len(got.Base.Rows[0].Blocks[0].Marks) != 2 {
		t.Fatalf("marks = %+v", got.Base.Rows[0].Blocks[0].Marks)
	}

	// An unsafe color is rejected.
	bad := colorMark("mbad", "red;evil")
	if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpAddMark, BlockID: "b1", Mark: &bad},
	}); !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Fatalf("unsafe color = %v, want ErrInvalidChangeSet", err)
	}

	// A font mark with no family or size is rejected.
	empty := document.Mark{ID: "me", Kind: document.MarkKindFont, Attrs: map[string]string{},
		Start: document.Anchor{AtomID: "a1", Offset: 0}, End: document.Anchor{AtomID: "a1", Offset: 5}}
	if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpAddMark, BlockID: "b1", Mark: &empty},
	}); !errors.Is(err, document.ErrInvalidChangeSet) {
		t.Fatalf("empty font = %v, want ErrInvalidChangeSet", err)
	}
}

// The document default typography is set and cleared as a Base-level op, and is
// reversible.
func TestSetDefaultTypography(t *testing.T) {
	d := newDocs()
	doc, _ := d.Create("p", "Doc", oneAtomDoc("hello"))
	cs, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpSetDefaultTypography, CustomTypography: &document.CustomTypography{FontFamily: "Georgia", Foreground: "#222"}},
	})
	if err != nil {
		t.Fatalf("set default typography: %v", err)
	}
	if got, _ := d.Get("p", doc.ID); got.Base.DefaultTypography == nil || got.Base.DefaultTypography.FontFamily != "Georgia" {
		t.Fatalf("default typography = %+v", got.Base.DefaultTypography)
	}
	if _, err := d.Undo("p", doc.ID, "u", cs.ID); err != nil {
		t.Fatalf("undo: %v", err)
	}
	if got, _ := d.Get("p", doc.ID); got.Base.DefaultTypography != nil {
		t.Fatalf("default typography after undo = %+v, want nil", got.Base.DefaultTypography)
	}
}

// The resolver takes each property from the first level that sets it, per
// property and independently — inline size, block color, sub-kind family and
// background, over the document default.
func TestResolveTypographyCascade(t *testing.T) {
	base := document.Base{
		DefaultTypography: &document.CustomTypography{FontFamily: "DocFont", Foreground: "docblue"},
		StyleRegistry: document.StyleRegistry{Definitions: []document.StyleDefinition{
			{ID: "callout", Name: "Callout", AppliesTo: []string{document.BlockKindText},
				Custom: &document.CustomTypography{FontFamily: "SubFont", Background: "subbg"}},
		}},
	}
	block := document.Block{
		Kind: document.BlockKindText, SubKind: "callout",
		StyleRef: &document.BlockStyleRef{Overrides: document.StyleOverrides{
			Custom: &document.CustomTypography{Foreground: "blockred"},
		}},
	}
	eff := document.ResolveTypography(base, block, document.CustomTypography{FontSize: "20px"})
	if eff.FontSize != "20px" {
		t.Errorf("size = %q, want inline 20px", eff.FontSize)
	}
	if eff.Foreground != "blockred" {
		t.Errorf("color = %q, want block override blockred", eff.Foreground)
	}
	if eff.FontFamily != "SubFont" {
		t.Errorf("family = %q, want sub-kind SubFont", eff.FontFamily)
	}
	if eff.Background != "subbg" {
		t.Errorf("background = %q, want sub-kind subbg", eff.Background)
	}
}

// A built-in sub-kind with no overrides resolves to its built-in typography.
func TestResolveTypographyBuiltin(t *testing.T) {
	base := document.Base{}
	h1 := document.Block{Kind: document.BlockKindText, SubKind: document.SubKindHeading1}
	if eff := document.ResolveTypography(base, h1, document.CustomTypography{}); eff.FontSize != "32px" {
		t.Errorf("heading_1 size = %q, want built-in 32px", eff.FontSize)
	}
	body := document.Block{Kind: document.BlockKindText, SubKind: document.SubKindBody}
	if eff := document.ResolveTypography(base, body, document.CustomTypography{}); eff.FontSize != "16px" {
		t.Errorf("body size = %q, want built-in 16px", eff.FontSize)
	}
}

// Markdown export drops non-representable marks (font/color/background) but keeps
// the representable ones (bold).
func TestMarkdownDropsNonRepresentableMarks(t *testing.T) {
	d := newDocs()
	doc, _ := d.Create("p", "Doc", oneAtomDoc("hello"))
	bold := document.Mark{ID: "mb", Kind: document.MarkKindBold,
		Start: document.Anchor{AtomID: "a1", Offset: 0}, End: document.Anchor{AtomID: "a1", Offset: 5}}
	color := colorMark("mc", "#ff0000")
	if _, err := submitChanges(d, "p", doc.ID, "u", []document.ChangeOp{
		{Op: document.OpAddMark, BlockID: "b1", Mark: &bold},
		{Op: document.OpAddMark, BlockID: "b1", Mark: &color},
	}); err != nil {
		t.Fatalf("add marks: %v", err)
	}
	_, md, err := d.ExportMarkdown("p", doc.ID)
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	if !strings.Contains(md, "**hello**") {
		t.Errorf("export lost bold: %q", md)
	}
	if strings.Contains(md, "ff0000") || strings.Contains(md, "color") {
		t.Errorf("export leaked color styling: %q", md)
	}
}

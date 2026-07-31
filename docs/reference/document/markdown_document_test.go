package document_test

import (
	"strings"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

func TestImportMarkdownStructure(t *testing.T) {
	docs := document.New(document.NewMemoryStore(), document.Options{})
	md := "# Title\n\nA paragraph with **bold** and _italic_ words.\n\n## Section\n\n> A quote line.\n"

	created, err := docs.ImportMarkdown("p1", "Imported", md)
	if err != nil {
		t.Fatalf("ImportMarkdown: %v", err)
	}
	doc, err := docs.Get("p1", created.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	rows := doc.Base.Rows
	if len(rows) != 4 {
		t.Fatalf("want 4 rows, got %d: %+v", len(rows), rows)
	}
	assertTextSubKind(t, rows[0], document.SubKindHeading1, "Title")
	assertTextSubKind(t, rows[2], document.SubKindHeading2, "Section")
	assertTextSubKind(t, rows[3], document.SubKindBody, "A quote line.")

	// The paragraph carries a bold and an italic mark over its inline runs.
	para := rows[1].Blocks[0]
	if para.Kind != document.BlockKindText {
		t.Errorf("row 1 kind = %q, want paragraph", para.Kind)
	}
	var bold, italic int
	for _, m := range para.Marks {
		switch m.Kind {
		case document.MarkKindBold:
			bold++
		case document.MarkKindItalic:
			italic++
		}
	}
	if bold != 1 || italic != 1 {
		t.Errorf("paragraph marks: bold=%d italic=%d, want 1/1 (%+v)", bold, italic, para.Marks)
	}
}

func TestExportMarkdownDeterministic(t *testing.T) {
	docs := document.New(document.NewMemoryStore(), document.Options{})
	base := document.Base{Rows: []document.Row{
		{ID: "r1", Blocks: []document.Block{{ID: "b1", Kind: document.BlockKindText, SubKind: document.SubKindHeading1,
			Atoms: []document.Atom{{ID: "a1", Kind: document.AtomKindText, Text: "Title"}}}}},
		{ID: "r2", Blocks: []document.Block{{ID: "b2", Kind: document.BlockKindText,
			Atoms: []document.Atom{{ID: "a2", Kind: document.AtomKindText, Text: "Plain body."}}}}},
		{ID: "r3", Blocks: []document.Block{{ID: "b3", Kind: document.BlockKindText,
			Atoms: []document.Atom{{ID: "a3", Kind: document.AtomKindText, Text: "A quote."}}}}},
	}}
	created, err := docs.Create("p1", "Doc", base)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	_, md, err := docs.ExportMarkdown("p1", created.ID)
	if err != nil {
		t.Fatalf("ExportMarkdown: %v", err)
	}
	want := "# Title\n\nPlain body.\n\nA quote.\n"
	if md != want {
		t.Errorf("export mismatch:\n got %q\nwant %q", md, want)
	}
}

func TestMarkdownRoundTripPreservesInline(t *testing.T) {
	docs := document.New(document.NewMemoryStore(), document.Options{})
	md := "## Heading\n\nText with **strong** emphasis.\n"
	created, _ := docs.ImportMarkdown("p1", "RT", md)
	_, out, err := docs.ExportMarkdown("p1", created.ID)
	if err != nil {
		t.Fatalf("ExportMarkdown: %v", err)
	}
	if !strings.Contains(out, "## Heading") {
		t.Errorf("export lost the heading: %q", out)
	}
	if !strings.Contains(out, "**strong**") {
		t.Errorf("export lost bold inline: %q", out)
	}
}

// TestMarkdownRoundTripPreservesLiteralSpecials is a regression test: prose with
// stray * / _ / escaped delimiters must survive an import→export→import cycle
// unchanged, instead of being silently italicized or corrupted.
func TestMarkdownRoundTripPreservesLiteralSpecials(t *testing.T) {
	docs := document.New(document.NewMemoryStore(), document.Options{})
	for _, body := range []string{
		"A price: 5 * 3 = 15 and 2 * 4",
		"snake_case_var and another_name stay literal",
		"a lone star * and underscore _ in prose",
	} {
		created, err := docs.ImportMarkdown("p1", "RT", body+"\n")
		if err != nil {
			t.Fatalf("import %q: %v", body, err)
		}
		imported := paragraphText(t, docs, created.ID)
		if imported != body {
			t.Errorf("import mangled prose:\n got %q\nwant %q", imported, body)
		}
		// Export then re-import must reproduce the same text (lossless round-trip).
		_, md, err := docs.ExportMarkdown("p1", created.ID)
		if err != nil {
			t.Fatalf("export: %v", err)
		}
		reimported, _ := docs.ImportMarkdown("p1", "RT2", md)
		if got := paragraphText(t, docs, reimported.ID); got != body {
			t.Errorf("round-trip changed prose:\n got %q\nwant %q\n(intermediate markdown %q)", got, body, md)
		}
	}
}

func paragraphText(t *testing.T, docs *document.Documents, docID string) string {
	t.Helper()
	got, err := docs.Get("p1", docID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	var sb string
	for _, row := range got.Base.Rows {
		for _, b := range row.Blocks {
			for _, a := range b.Atoms {
				sb += a.Text
			}
		}
	}
	return sb
}

// assertTextSubKind checks that a row holds one text block with the given
// sub-kind and concatenated atom text.
func assertTextSubKind(t *testing.T, row document.Row, subKind, text string) {
	t.Helper()
	if len(row.Blocks) != 1 {
		t.Fatalf("row %s: want 1 block, got %d", row.ID, len(row.Blocks))
	}
	b := row.Blocks[0]
	if b.Kind != document.BlockKindText {
		t.Errorf("row %s: kind = %q, want text", row.ID, b.Kind)
	}
	if b.SubKind != subKind {
		t.Errorf("row %s: subKind = %q, want %q", row.ID, b.SubKind, subKind)
	}
	var got string
	for _, a := range b.Atoms {
		got += a.Text
	}
	if got != text {
		t.Errorf("row %s: text = %q, want %q", row.ID, got, text)
	}
}

func assertKindText(t *testing.T, row document.Row, kind, text string) {
	t.Helper()
	if len(row.Blocks) != 1 {
		t.Fatalf("row %s: want 1 block, got %d", row.ID, len(row.Blocks))
	}
	b := row.Blocks[0]
	if b.Kind != kind {
		t.Errorf("row %s: kind = %q, want %q", row.ID, b.Kind, kind)
	}
	var got string
	for _, a := range b.Atoms {
		got += a.Text
	}
	if got != text {
		t.Errorf("row %s: text = %q, want %q", row.ID, got, text)
	}
}

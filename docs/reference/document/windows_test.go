package document_test

import (
	"errors"
	"fmt"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/document"
)

func makeRowDoc(t *testing.T, n int) (*document.Documents, document.Document) {
	t.Helper()
	docs := document.New(document.NewMemoryStore(), document.Options{})
	var rows []document.Row
	for i := 0; i < n; i++ {
		rows = append(rows, document.Row{
			ID: fmt.Sprintf("r%d", i),
			Blocks: []document.Block{{
				ID:   fmt.Sprintf("b%d", i),
				Kind: document.BlockKindText,
				Atoms: []document.Atom{{
					ID: fmt.Sprintf("a%d", i), Kind: document.AtomKindText,
					Text: fmt.Sprintf("row %d body text", i),
				}},
			}},
		})
	}
	doc, err := docs.Create("p1", "Big", document.Base{Rows: rows})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	return docs, doc
}

func TestDescriptorMatchesFullRead(t *testing.T) {
	docs, doc := makeRowDoc(t, 5)
	desc, err := docs.Descriptor("p1", doc.ID)
	if err != nil {
		t.Fatalf("Descriptor: %v", err)
	}
	full, _ := docs.Get("p1", doc.ID)
	if desc.RowCount != len(full.Base.Rows) || desc.RowCount != 5 {
		t.Errorf("rowCount %d != full read %d", desc.RowCount, len(full.Base.Rows))
	}
	if desc.ID != doc.ID || desc.Name != "Big" || desc.Revision != full.Revision {
		t.Errorf("descriptor mismatch: %+v (full rev %d)", desc, full.Revision)
	}
}

func TestRowManifestOffsetsAreCumulative(t *testing.T) {
	docs, doc := makeRowDoc(t, 5)
	man, err := docs.RowManifest("p1", doc.ID)
	if err != nil {
		t.Fatalf("RowManifest: %v", err)
	}
	if len(man.Rows) != 5 {
		t.Fatalf("want 5 metrics, got %d", len(man.Rows))
	}
	var sum document.LayoutUnit
	for i, m := range man.Rows {
		if m.ID != fmt.Sprintf("r%d", i) {
			t.Errorf("metric %d id = %q", i, m.ID)
		}
		if m.Height <= 0 {
			t.Errorf("metric %d height must be positive, got %v", i, m.Height)
		}
		if m.Offset != sum {
			t.Errorf("metric %d offset = %v, want cumulative %v", i, m.Offset, sum)
		}
		sum += m.Height
	}
}

func TestRowWindowByIndexAndID(t *testing.T) {
	docs, doc := makeRowDoc(t, 5)

	// By index: [1, 3) → r1, r2.
	win, err := docs.RowWindow("p1", doc.ID, "1", 2)
	if err != nil {
		t.Fatalf("RowWindow index: %v", err)
	}
	if win.From != 1 || len(win.Rows) != 2 || win.Rows[0].ID != "r1" || win.Rows[1].ID != "r2" {
		t.Errorf("index window wrong: %+v", win)
	}

	// By row id, count past the end clamps to the last row.
	win2, err := docs.RowWindow("p1", doc.ID, "r3", 10)
	if err != nil {
		t.Fatalf("RowWindow id: %v", err)
	}
	if win2.From != 3 || len(win2.Rows) != 2 || win2.Rows[0].ID != "r3" || win2.Rows[1].ID != "r4" {
		t.Errorf("id window wrong: %+v", win2)
	}

	// An unknown from is not found.
	if _, err := docs.RowWindow("p1", doc.ID, "nope", 2); !errors.Is(err, document.ErrNotFound) {
		t.Errorf("unknown from: want ErrNotFound, got %v", err)
	}
}

func TestLocate(t *testing.T) {
	docs, doc := makeRowDoc(t, 5)
	man, _ := docs.RowManifest("p1", doc.ID)

	loc, err := docs.Locate("p1", doc.ID, "a2", 0, false)
	if err != nil {
		t.Fatalf("Locate atom: %v", err)
	}
	if loc.RowID != "r2" || loc.Index != 2 || loc.Offset != man.Rows[2].Offset {
		t.Errorf("locate atom wrong: %+v (want offset %v)", loc, man.Rows[2].Offset)
	}

	byIdx, err := docs.Locate("p1", doc.ID, "", 4, true)
	if err != nil {
		t.Fatalf("Locate index: %v", err)
	}
	if byIdx.RowID != "r4" || byIdx.Index != 4 {
		t.Errorf("locate index wrong: %+v", byIdx)
	}

	if _, err := docs.Locate("p1", doc.ID, "ghost", 0, false); !errors.Is(err, document.ErrNotFound) {
		t.Errorf("unknown atom: want ErrNotFound, got %v", err)
	}
	if _, err := docs.Locate("p1", doc.ID, "", 99, true); !errors.Is(err, document.ErrNotFound) {
		t.Errorf("out-of-range index: want ErrNotFound, got %v", err)
	}
}

func TestWindowRevisionChangesAfterEdit(t *testing.T) {
	docs, doc := makeRowDoc(t, 3)
	before, _ := docs.Descriptor("p1", doc.ID)

	newText := "edited"
	if _, err := docs.SubmitChanges("p1", doc.ID, "u1", document.ChangeSubmission{
		SubmissionID:     "edit-1",
		ExpectedRevision: before.Revision,
		Operations:       []document.ChangeOp{{Op: document.OpSetAtomText, BlockID: "b0", AtomID: "a0", SetText: &newText}},
	}); err != nil {
		t.Fatalf("SubmitChanges: %v", err)
	}

	after, _ := docs.Descriptor("p1", doc.ID)
	if after.Revision == before.Revision {
		t.Errorf("revision should advance after an edit (before=%d after=%d)", before.Revision, after.Revision)
	}
	// A window read carries the same advanced revision.
	win, _ := docs.RowWindow("p1", doc.ID, "", 10)
	if win.Revision != after.Revision {
		t.Errorf("window revision %d != descriptor revision %d", win.Revision, after.Revision)
	}
}

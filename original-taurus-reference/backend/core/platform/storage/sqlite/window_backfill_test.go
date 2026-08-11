package sqlite

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// writeOldShapeSource stores a source the way rows looked before the lattice
// stopped keeping a copy of the text: a populated text column, and none of the
// metadata derived from it.
//
// Both halves need raw SQL now, and for the same reason: the current write path
// writes text empty and the metadata filled in, which is the exact opposite of the
// shape a migration has to be tested against.
func writeOldShapeSource(t *testing.T, s *Store, refID, text string, blocks []knowledge.BlockSpan) {
	t.Helper()
	src := knowledge.Source{
		LocalRefID: refID, ProjectID: "p", SourceType: knowledge.SourceTypeDocument,
		SourceID: "doc-" + refID, Blocks: blocks,
		AddedAt: time.Unix(1, 0).UTC(), SyncedAt: time.Unix(1, 0).UTC(),
	}
	if err := s.ReplaceSources([]knowledge.SourceWrite{{Source: src}}); err != nil {
		t.Fatalf("write source: %v", err)
	}
	if _, err := s.db.Exec(
		`UPDATE knowledge_sources SET text = ?, size_bytes = 0, line_count = 0, content_hash = ''
		 WHERE local_ref_id = ?`, text, refID,
	); err != nil {
		t.Fatalf("restore pre-migration source shape: %v", err)
	}
}

// writeOldShapeWindow stores a source and a window the way rows looked before a
// window carried its own text: the range is there, the text and blocks columns are
// empty. Written with raw SQL on purpose — the current write path fills them in, so
// the pre-migration shape cannot be produced through it.
func writeOldShapeWindow(t *testing.T, s *Store, refID, text string, blocks []knowledge.BlockSpan, start, end int) string {
	t.Helper()
	writeOldShapeSource(t, s, refID, text, blocks)
	id := "win-" + refID
	if _, err := s.db.Exec(
		`INSERT INTO knowledge_windows(id, local_ref_id, ordinal, win_start, win_end, embedding, text, blocks)
		 VALUES(?, ?, 0, ?, ?, '', '', '[]')`,
		id, refID, start, end,
	); err != nil {
		t.Fatalf("write old-shape window: %v", err)
	}
	return id
}

// The backfill gives an old-shape window its own text and covered blocks, computed
// from the source snapshot and the range it already had.
//
// It has to be a pure local computation: embeddings cost real money, so a migration
// that re-windowed or re-embedded would bill the user to recover data already on
// disk. This asserts the text matches the range exactly, and the blocks match what
// the runtime would compute for the same range — the reason CoveredBlocks is
// exported rather than reimplemented here.
func TestBackfillWindowTextFillsFromTheSourceSnapshot(t *testing.T) {
	s := openTemp(t)
	text := "Alpha beta gamma. Delta epsilon zeta. Eta theta iota."
	blocks := []knowledge.BlockSpan{
		{RowID: "r1", BlockID: "b1", Start: 0, End: 18},
		{RowID: "r2", BlockID: "b2", Start: 18, End: len(text)},
	}
	id := writeOldShapeWindow(t, s, "ref1", text, blocks, 6, 30)

	if err := s.backfillWindowText(); err != nil {
		t.Fatalf("backfill: %v", err)
	}

	content, err := s.WindowContent([]string{id})
	if err != nil {
		t.Fatalf("WindowContent: %v", err)
	}
	got, ok := content[id]
	if !ok {
		t.Fatal("window has no content after the backfill")
	}
	if want := text[6:30]; got.Text != want {
		t.Errorf("text = %q, want %q", got.Text, want)
	}
	want := knowledge.CoveredBlocks(blocks, 6, 30)
	if len(got.Blocks) != len(want) {
		t.Fatalf("blocks = %+v, want %+v", got.Blocks, want)
	}
	for i := range want {
		if got.Blocks[i] != want[i] {
			t.Errorf("block %d = %+v, want %+v", i, got.Blocks[i], want[i])
		}
	}
}

// Running it twice changes nothing the second time. The WHERE clause is the progress
// marker, which is what makes the migration resumable: a run that dies partway leaves
// finished rows finished, and the next startup picks up only the rest.
func TestBackfillWindowTextIsIdempotent(t *testing.T) {
	s := openTemp(t)
	text := "Alpha beta gamma. Delta epsilon zeta."
	id := writeOldShapeWindow(t, s, "ref1", text, nil, 0, 17)

	if err := s.backfillWindowText(); err != nil {
		t.Fatalf("first backfill: %v", err)
	}
	first, _ := s.WindowContent([]string{id})
	if err := s.backfillWindowText(); err != nil {
		t.Fatalf("second backfill: %v", err)
	}
	second, _ := s.WindowContent([]string{id})

	if first[id].Text != second[id].Text {
		t.Errorf("second run changed the text: %q then %q", first[id].Text, second[id].Text)
	}
	if first[id].Text != text[0:17] {
		t.Errorf("text = %q, want %q", first[id].Text, text[0:17])
	}
}

// A window whose range does not fit its source is left alone rather than truncated
// into something plausible.
//
// The two disagreeing can only mean the row is stale, and inventing citable text from
// a range that does not fit is the worst available outcome — it would read as a real
// quotation. Leaving it empty keeps it visibly unfilled for the next re-sync to
// rebuild.
func TestBackfillWindowTextSkipsRangesThatDoNotFit(t *testing.T) {
	s := openTemp(t)
	text := "short"
	id := writeOldShapeWindow(t, s, "ref1", text, nil, 0, 500)

	if err := s.backfillWindowText(); err != nil {
		t.Fatalf("backfill: %v", err)
	}
	content, _ := s.WindowContent([]string{id})
	if content[id].Text != "" {
		t.Errorf("text = %q, want it left empty", content[id].Text)
	}
}

// The migration runs the backfill, so an existing database is repaired by opening it
// — nobody has to remember a step.
func TestOpenBackfillsWindowText(t *testing.T) {
	path := filepath.Join(t.TempDir(), "backfill.db")
	s, err := Open(path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	text := "Alpha beta gamma. Delta epsilon zeta."
	id := writeOldShapeWindow(t, s, "ref1", text, nil, 0, 17)
	s.Close()

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer reopened.Close()

	content, err := reopened.WindowContent([]string{id})
	if err != nil {
		t.Fatalf("WindowContent: %v", err)
	}
	if content[id].Text != text[0:17] {
		t.Errorf("reopening did not backfill: text = %q", content[id].Text)
	}
}

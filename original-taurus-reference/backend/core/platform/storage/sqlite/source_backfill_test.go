package sqlite

import (
	"path/filepath"
	"testing"

	"github.com/gccurtis/taurus-omega/core/capability/knowledge"
)

// storedSourceText reads the raw text column, which nothing in the running system
// reads any more — the point of these tests being that it ends up empty.
func storedSourceText(t *testing.T, s *Store, refID string) string {
	t.Helper()
	var text string
	if err := s.db.QueryRow(`SELECT text FROM knowledge_sources WHERE local_ref_id = ?`, refID).Scan(&text); err != nil {
		t.Fatalf("read stored text for %q: %v", refID, err)
	}
	return text
}

// The metadata a source keeps is derived from the copy it is about to lose, using
// the same two functions ingest uses.
//
// The hash is the load-bearing one. unchangedFrom compares it against
// knowledge.ContentHash of the incoming snapshot, so a hash computed even slightly
// differently here would make every migrated source compare as changed and
// re-cluster on its first sync — the exact cost the backfill exists to avoid, and
// invisible when it happens.
func TestBackfillSourceMetadataDerivesItFromTheStoredText(t *testing.T) {
	s := openTemp(t)
	text := "Alpha beta gamma.\nDelta epsilon zeta.\nEta theta iota.\n"
	writeOldShapeSource(t, s, "ref1", text, nil)

	if err := s.backfillSourceMetadata(); err != nil {
		t.Fatalf("backfill: %v", err)
	}

	got, ok, err := s.SourceByOrigin("p", knowledge.SourceTypeDocument, "doc-ref1")
	if err != nil || !ok {
		t.Fatalf("SourceByOrigin: ok=%v err=%v", ok, err)
	}
	if got.SizeBytes != len(text) {
		t.Errorf("sizeBytes = %d, want %d", got.SizeBytes, len(text))
	}
	if want := knowledge.CountLines(text); got.LineCount != want {
		t.Errorf("lineCount = %d, want %d", got.LineCount, want)
	}
	if want := knowledge.ContentHash(text); got.ContentHash != want {
		t.Errorf("contentHash = %q, want %q — a re-sync of identical content would not skip", got.ContentHash, want)
	}
}

// An empty source still gets a real hash, because the empty string is the "not yet
// backfilled" marker and a row that genuinely holds nothing must not look like one
// forever.
func TestBackfillSourceMetadataHashesEmptyContentToo(t *testing.T) {
	s := openTemp(t)
	writeOldShapeSource(t, s, "ref1", "", nil)

	if err := s.backfillSourceMetadata(); err != nil {
		t.Fatalf("backfill: %v", err)
	}

	got, _, _ := s.SourceByOrigin("p", knowledge.SourceTypeDocument, "doc-ref1")
	if got.ContentHash != knowledge.ContentHash("") {
		t.Errorf("contentHash = %q, want the hash of the empty string", got.ContentHash)
	}
	if got.SizeBytes != 0 || got.LineCount != 0 {
		t.Errorf("empty source reported size %d / %d lines", got.SizeBytes, got.LineCount)
	}
}

// The second copy goes once the windows can stand in for it.
func TestBlankSourceTextClearsTheCopyOnceWindowsCarryTheirOwn(t *testing.T) {
	s := openTemp(t)
	text := "Alpha beta gamma. Delta epsilon zeta."
	id := writeOldShapeWindow(t, s, "ref1", text, nil, 0, 17)

	if err := s.backfillWindowText(); err != nil {
		t.Fatalf("window backfill: %v", err)
	}
	if err := s.blankSourceText(); err != nil {
		t.Fatalf("blank: %v", err)
	}

	if got := storedSourceText(t, s, "ref1"); got != "" {
		t.Errorf("source text = %q, want it blanked", got)
	}
	content, _ := s.WindowContent([]string{id})
	if content[id].Text != text[0:17] {
		t.Errorf("blanking cost the window its text: %q", content[id].Text)
	}
}

// The gate. A source with any window still missing its text keeps its copy.
//
// This is the one irreversible step in the phase, and the failure it prevents is
// total: backfillWindowText skips a window whose range does not fit its source, so
// without the gate the very rows that could not be reconstructed are the rows whose
// only remaining source of truth gets erased. Nothing would report it — the read
// would simply return less than it should, forever.
func TestBlankSourceTextKeepsACopyAWindowStillNeeds(t *testing.T) {
	s := openTemp(t)
	text := "short"
	// The range does not fit, so backfillWindowText leaves this window empty.
	id := writeOldShapeWindow(t, s, "ref1", text, nil, 0, 500)

	if err := s.backfillWindowText(); err != nil {
		t.Fatalf("window backfill: %v", err)
	}
	if content, _ := s.WindowContent([]string{id}); content[id].Text != "" {
		t.Fatalf("fixture is wrong: the window was filled, so there is no gate to test")
	}

	if err := s.blankSourceText(); err != nil {
		t.Fatalf("blank: %v", err)
	}
	if got := storedSourceText(t, s, "ref1"); got != text {
		t.Errorf("source text = %q, want %q kept while a window is unfilled", got, text)
	}
}

// One source failing the gate must not hold back the rest. Blanking is per source
// precisely so that a single stale window cannot pin the whole project's second
// copy in place.
func TestBlankSourceTextIsDecidedPerSource(t *testing.T) {
	s := openTemp(t)
	good := "Alpha beta gamma. Delta epsilon zeta."
	writeOldShapeWindow(t, s, "ok", good, nil, 0, 17)
	writeOldShapeWindow(t, s, "stale", "short", nil, 0, 500)

	if err := s.backfillWindowText(); err != nil {
		t.Fatalf("window backfill: %v", err)
	}
	if err := s.blankSourceText(); err != nil {
		t.Fatalf("blank: %v", err)
	}

	if got := storedSourceText(t, s, "ok"); got != "" {
		t.Errorf("the sound source kept its text: %q", got)
	}
	if got := storedSourceText(t, s, "stale"); got != "short" {
		t.Errorf("the stale source lost its text: %q", got)
	}
}

// A source with no windows at all is blanked. windowSpans drops all-whitespace
// windows, so a source that produced none has nothing but whitespace to lose, and
// the gate must not treat "no windows" as "windows not yet filled" — that would
// pin those rows forever.
func TestBlankSourceTextBlanksASourceWithNoWindows(t *testing.T) {
	s := openTemp(t)
	writeOldShapeSource(t, s, "ref1", "   \n  ", nil)

	if err := s.blankSourceText(); err != nil {
		t.Fatalf("blank: %v", err)
	}
	if got := storedSourceText(t, s, "ref1"); got != "" {
		t.Errorf("source text = %q, want it blanked", got)
	}
}

// Opening a database runs both steps, in the order that matters: the metadata is
// derived from the text before the text is erased. Getting that backwards would
// leave every migrated source reporting zero bytes and an empty hash, with the
// only thing that could recompute them gone.
func TestOpenMigratesSourceTextIntoMetadata(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sources.db")
	s, err := Open(path)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	text := "Alpha beta gamma. Delta epsilon zeta."
	writeOldShapeWindow(t, s, "ref1", text, nil, 0, 17)
	s.Close()

	reopened, err := Open(path)
	if err != nil {
		t.Fatalf("reopen: %v", err)
	}
	defer reopened.Close()

	got, ok, err := reopened.SourceByOrigin("p", knowledge.SourceTypeDocument, "doc-ref1")
	if err != nil || !ok {
		t.Fatalf("SourceByOrigin: ok=%v err=%v", ok, err)
	}
	if got.SizeBytes != len(text) || got.ContentHash != knowledge.ContentHash(text) {
		t.Errorf("metadata not derived before the text was erased: %d bytes, hash %q", got.SizeBytes, got.ContentHash)
	}
	if raw := storedSourceText(t, reopened, "ref1"); raw != "" {
		t.Errorf("reopening did not blank the second copy: %q", raw)
	}
}

// Running the pair twice changes nothing the second time — the WHERE clauses are
// the progress markers, which is what makes them resumable after a partial run.
func TestSourceMigrationIsIdempotent(t *testing.T) {
	s := openTemp(t)
	text := "Alpha beta gamma. Delta epsilon zeta."
	writeOldShapeWindow(t, s, "ref1", text, nil, 0, 17)

	for i := 0; i < 2; i++ {
		if err := s.backfillWindowText(); err != nil {
			t.Fatalf("run %d window backfill: %v", i, err)
		}
		if err := s.backfillSourceMetadata(); err != nil {
			t.Fatalf("run %d metadata: %v", i, err)
		}
		if err := s.blankSourceText(); err != nil {
			t.Fatalf("run %d blank: %v", i, err)
		}
	}

	got, _, _ := s.SourceByOrigin("p", knowledge.SourceTypeDocument, "doc-ref1")
	if got.SizeBytes != len(text) || got.ContentHash != knowledge.ContentHash(text) {
		t.Errorf("the second run rewrote the metadata from the blanked text: %d bytes, hash %q",
			got.SizeBytes, got.ContentHash)
	}
}

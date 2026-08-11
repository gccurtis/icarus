package connector

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type partialSyncError struct{ cause error }

func (e partialSyncError) Error() string         { return e.cause.Error() }
func (e partialSyncError) Unwrap() error         { return e.cause }
func (e partialSyncError) PartialProgress() bool { return true }

type partialFailLattice struct{ *fakeLattice }

func (l *partialFailLattice) AddSources(projectID string, files []LatticeFileWrite) (Usage, []SkippedFile, error) {
	l.calls++
	return Usage{PromptTokens: 11, TotalTokens: 13}, nil, partialSyncError{cause: errors.New("capacity refused after a committed slice")}
}

type fakeLattice struct {
	added map[string]string
	// label is the path each source was stored under. The real lattice keeps it
	// beside the id, and that pairing is what lets a re-sync find the id it
	// already minted for a path — so a fake that dropped it would let a
	// regression in id stability pass.
	label map[string]string
	rev   map[string]int64
	calls int
}

func newFakeLattice() *fakeLattice {
	return &fakeLattice{added: map[string]string{}, label: map[string]string{}, rev: map[string]int64{}}
}

// calls counts AddSources invocations — the number a rate limit cares about,
// since one call is one embedding batch however many files it carries.
func (f *fakeLattice) AddSources(projectID string, files []LatticeFileWrite) (Usage, []SkippedFile, error) {
	f.calls++
	var usage Usage
	for _, w := range files {
		f.added[w.SourceID] = readWrite(w)
		f.label[w.SourceID] = w.Label
		f.rev[w.SourceID] = w.Revision
		usage.PromptTokens += 3
		usage.TotalTokens += 7
	}
	return usage, nil, nil
}

// readWrite pulls a write's content through its opener, which is how the real
// lattice consumes one now. A file whose opener fails reads as empty here; the
// tests that care about that failure assert on SkippedFile instead.
func readWrite(w LatticeFileWrite) string {
	if w.Open == nil {
		return ""
	}
	rc, err := w.Open()
	if err != nil {
		return ""
	}
	defer rc.Close()
	b, _ := io.ReadAll(rc)
	return string(b)
}

// SourcesUnder mirrors the real lattice's live enumeration: it reflects
// whatever is currently in added, not a separately maintained snapshot, so
// tests see the same ordering-sensitive behavior applySync relies on (prune
// runs after this sync's AddSource calls, against sources still present from
// prior syncs).
func (f *fakeLattice) SourcesUnder(projectID, sourceIDPrefix string) ([]LatticeFile, error) {
	var out []LatticeFile
	for sid := range f.added {
		if strings.HasPrefix(sid, sourceIDPrefix) {
			out = append(out, LatticeFile{SourceID: sid, Key: f.label[sid]})
		}
	}
	return out, nil
}

// pathToSourceID reports the id currently stored for a synced path, or "" when
// no source carries it. Tests address files by path because that is the only
// name a provider knows them by — the id is minted here, not derived.
func (f *fakeLattice) pathToSourceID(path string) string {
	for sid, l := range f.label {
		if l == path {
			return sid
		}
	}
	return ""
}

// pathToSourceID2 is pathToSourceID narrowed to one connector, for tests that
// sync two connectors holding files of the same name.
func (f *fakeLattice) pathToSourceID2(connectorID, path string) string {
	for sid, l := range f.label {
		if l == path && strings.HasPrefix(sid, connectorID+FileSeparator) {
			return sid
		}
	}
	return ""
}

type recordingCosts struct {
	last  Usage
	calls int
}

func (r *recordingCosts) RecordSyncCost(projectID, connectorID string, usage Usage) {
	r.last = usage
	r.calls++
}

func (f *fakeLattice) RemoveSource(projectID, sourceID string) error {
	delete(f.added, sourceID)
	return nil
}

func localFolderFactory(c Connector) (Provider, error) { return NewLocalFolderProvider(c.Path), nil }

type recordingCascader struct{ calls []string }

func (r *recordingCascader) RefreshDependents(projectID, sourceType, sourceID string) {
	r.calls = append(r.calls, projectID+"/"+sourceType+"/"+sourceID)
}

func TestSyncTriggersCascadeOnlyWhenChanged(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "f.txt"), []byte("v1"), 0o644); err != nil {
		t.Fatal(err)
	}
	casc := &recordingCascader{}
	c := NewWithSync(NewMemoryStore(nil), localFolderFactory, newFakeLattice())
	c.UseCascader(casc)
	made, _ := c.Create("p", Actor{ID: "u1"}, "d", SubKindLocalFolder)
	made, _ = c.Configure("p", made.ID, dir)

	if _, err := c.Sync("p", made.ID); err != nil { // changed
		t.Fatalf("sync: %v", err)
	}
	if len(casc.calls) != 1 || casc.calls[0] != "p/connector/"+made.ID {
		t.Fatalf("cascade calls after change: %+v", casc.calls)
	}
	if _, err := c.SyncIfChanged("p", made.ID); err != nil { // no change → no cascade
		t.Fatalf("sync-if-changed: %v", err)
	}
	if len(casc.calls) != 1 {
		t.Fatalf("cascade fired on no-op: %+v", casc.calls)
	}
}

func TestSyncReportsCommittedEarlierSlicesAsPartial(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "f.txt"), []byte("v1"), 0o644); err != nil {
		t.Fatal(err)
	}
	lattice := &partialFailLattice{fakeLattice: newFakeLattice()}
	c := NewWithSync(NewMemoryStore(nil), localFolderFactory, lattice)
	made, err := c.Create("p", Actor{ID: "u1"}, "d", SubKindLocalFolder)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := c.Configure("p", made.ID, dir); err != nil {
		t.Fatal(err)
	}

	res, err := c.Sync("p", made.ID)
	if err == nil {
		t.Fatal("Sync succeeded despite the lattice capacity refusal")
	}
	if !res.Partial || res.Usage.PromptTokens != 11 || res.Usage.TotalTokens != 13 {
		t.Fatalf("Sync result = %+v, want partial progress and retained usage", res)
	}
}

func TestSyncFeedsLatticeAndBumpsSeq(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "f.txt"), []byte("hello"), 0o644); err != nil {
		t.Fatal(err)
	}
	lat := newFakeLattice()
	c := NewWithSync(NewMemoryStore(nil), localFolderFactory, lat)
	made, _ := c.Create("p", Actor{ID: "u1"}, "drive", SubKindLocalFolder)
	made, _ = c.Configure("p", made.ID, dir)

	r1, err := c.Sync("p", made.ID)
	if err != nil || !r1.Changed || r1.Seq != 1 {
		t.Fatalf("first sync: %+v err=%v", r1, err)
	}
	// The id is minted, not derived from the path, so it is looked up by the only
	// name the provider knows the file by.
	fileID := lat.pathToSourceID("f.txt")
	if lat.added[fileID] == "" {
		t.Fatal("content not fed to lattice")
	}

	// No change → SyncIfChanged is a no-op.
	r2, err := c.SyncIfChanged("p", made.ID)
	if err != nil || r2.Changed {
		t.Fatalf("re-synced with no change: %+v err=%v", r2, err)
	}

	// Change the folder → SyncIfChanged re-syncs and bumps seq.
	if err := os.WriteFile(filepath.Join(dir, "f.txt"), []byte("HELLO WORLD"), 0o644); err != nil {
		t.Fatal(err)
	}
	r3, err := c.SyncIfChanged("p", made.ID)
	if err != nil || !r3.Changed || r3.Seq != 2 {
		t.Fatalf("expected re-sync seq 2: %+v err=%v", r3, err)
	}
	if lat.rev[fileID] != 2 {
		t.Fatalf("lattice revision = %d, want 2", lat.rev[fileID])
	}
}

func TestDetectChangesResyncsOnlyChanged(t *testing.T) {
	dirA := t.TempDir()
	dirB := t.TempDir()
	os.WriteFile(filepath.Join(dirA, "f.txt"), []byte("a"), 0o644)
	os.WriteFile(filepath.Join(dirB, "f.txt"), []byte("b"), 0o644)
	lat := newFakeLattice()
	c := NewWithSync(NewMemoryStore(nil), localFolderFactory, lat)
	a, _ := c.Create("p", Actor{ID: "u"}, "A", SubKindLocalFolder)
	a, _ = c.Configure("p", a.ID, dirA)
	b, _ := c.Create("p", Actor{ID: "u"}, "B", SubKindLocalFolder)
	b, _ = c.Configure("p", b.ID, dirB)
	c.Sync("p", a.ID)
	c.Sync("p", b.ID)

	// Change only A.
	os.WriteFile(filepath.Join(dirA, "f.txt"), []byte("AAA"), 0o644)
	out, err := c.DetectChanges()
	if err != nil || out.Changed != 1 || out.Failed != 0 {
		t.Fatalf("DetectChanges = %+v, %v; want 1 changed, 0 failed", out, err)
	}
	if id := lat.pathToSourceID2(a.ID, "f.txt"); lat.added[id] != "AAA" {
		t.Fatalf("A not re-synced with new content: %q", lat.added[id])
	}
}

// TestSyncAddsPerFileSourcesAndPrunesRemoved is the per-file sync contract: each
// file in the snapshot becomes its own lattice source keyed by FileSourceID, a
// file still present is re-added (its content/revision updated) rather than
// duplicated, and a file that vanished from the source is pruned via
// RemoveSource. Exactly one cascade fires per changed sync, regardless of how
// many files moved within it.
func TestSyncAddsPerFileSourcesAndPrunesRemoved(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("A"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "b.txt"), []byte("B"), 0o644); err != nil {
		t.Fatal(err)
	}
	lat := newFakeLattice()
	casc := &recordingCascader{}
	c := NewWithSync(NewMemoryStore(nil), localFolderFactory, lat)
	c.UseCascader(casc)
	made, _ := c.Create("p", Actor{ID: "u1"}, "d", SubKindLocalFolder)
	made, _ = c.Configure("p", made.ID, dir)

	if _, err := c.Sync("p", made.ID); err != nil {
		t.Fatalf("first sync: %v", err)
	}
	idA, idB := lat.pathToSourceID("a.txt"), lat.pathToSourceID("b.txt")
	if lat.added[idA] != "A" || lat.added[idB] != "B" {
		t.Fatalf("first sync sources = %+v, want a.txt and b.txt", lat.added)
	}
	if lat.rev[idA] != 1 || lat.rev[idB] != 1 {
		t.Fatalf("first sync revisions = %+v, want 1", lat.rev)
	}
	if len(casc.calls) != 1 || casc.calls[0] != "p/connector/"+made.ID {
		t.Fatalf("cascade calls after first sync: %+v", casc.calls)
	}

	// Drop b.txt, add c.txt, keep a.txt (content unchanged).
	if err := os.Remove(filepath.Join(dir, "b.txt")); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "c.txt"), []byte("C"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Sync("p", made.ID); err != nil {
		t.Fatalf("second sync: %v", err)
	}
	if _, ok := lat.added[idB]; ok {
		t.Fatalf("b.txt source not pruned: %+v", lat.added)
	}
	// a.txt survives the sync under the SAME id it was first given. This is the
	// property that makes minted ids safe: the id is recovered by looking its path
	// up in the lattice, so an unchanged file is updated in place. Minting a fresh
	// id each sync would re-embed every window and orphan anything already citing
	// the old one.
	if got := lat.pathToSourceID("a.txt"); got != idA {
		t.Fatalf("a.txt changed id across syncs: %q → %q", idA, got)
	}
	if lat.added[idA] != "A" || lat.rev[idA] != 2 {
		t.Fatalf("a.txt source not re-added/updated: content=%q rev=%d", lat.added[idA], lat.rev[idA])
	}
	if idC := lat.pathToSourceID("c.txt"); lat.added[idC] != "C" {
		t.Fatalf("c.txt source not added: %+v", lat.added)
	}
	if len(casc.calls) != 2 || casc.calls[1] != "p/connector/"+made.ID {
		t.Fatalf("cascade calls after second sync: %+v", casc.calls)
	}
}

func TestSyncRecordsCost(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "f.txt"), []byte("hi"), 0o644)
	costs := &recordingCosts{}
	c := NewWithSync(NewMemoryStore(nil), localFolderFactory, newFakeLattice())
	c.UseCostRecorder(costs)
	made, _ := c.Create("p", Actor{ID: "u"}, "d", SubKindLocalFolder)
	made, _ = c.Configure("p", made.ID, dir)

	res, err := c.Sync("p", made.ID)
	if err != nil {
		t.Fatalf("sync: %v", err)
	}
	if res.Usage != (Usage{PromptTokens: 3, TotalTokens: 7}) {
		t.Fatalf("sync result usage = %+v", res.Usage)
	}
	if costs.calls != 1 || costs.last != (Usage{PromptTokens: 3, TotalTokens: 7}) {
		t.Fatalf("cost not recorded: calls=%d last=%+v", costs.calls, costs.last)
	}
}

// TestDetectChangesReportsFailures pins the observability half of JOB-1's
// connector story. The detector reconciles every connector on a tick, and a
// connector whose source cannot be read must not fail the sweep — the other
// connectors still need syncing. But swallowing that error silently makes a
// connector that fails on every tick invisible forever, so the count must come
// back to the caller, which is what logs it.
func TestDetectChangesReportsFailures(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, "f.txt"), []byte("ok"), 0o644)
	lat := newFakeLattice()
	c := NewWithSync(NewMemoryStore(nil), localFolderFactory, lat)

	good, _ := c.Create("p", Actor{ID: "u"}, "Good", SubKindLocalFolder)
	good, _ = c.Configure("p", good.ID, dir)
	c.Sync("p", good.ID)

	// A connector pointed at a path that does not exist: its fetch fails every time.
	bad, _ := c.Create("p", Actor{ID: "u"}, "Bad", SubKindLocalFolder)
	bad, _ = c.Configure("p", bad.ID, filepath.Join(dir, "missing-dir"))

	os.WriteFile(filepath.Join(dir, "f.txt"), []byte("changed"), 0o644)

	out, err := c.DetectChanges()
	if err != nil {
		t.Fatalf("DetectChanges err = %v; a single bad connector must not fail the sweep", err)
	}
	if out.Changed != 1 {
		t.Fatalf("changed = %d, want 1 (the good connector still re-synced)", out.Changed)
	}
	if out.Failed != 1 {
		t.Fatalf("failed = %d, want 1 — a connector that cannot sync must be reported, not swallowed", out.Failed)
	}
}

// TestSamePathInTwoConnectorsStaysDistinct is the cross-connector collision
// case: two connectors each holding a file at the same relative path. Their lattice
// sources must be separate, because "exclude this one file" has to be able to
// name one of them without touching the other — and because a merged source
// would serve one connector's content under the other's scope.
//
// The prefix is what separates them: an id is minted per file and lives under
// its own connector's prefix, so the same path in two connectors is two ids.
func TestSamePathInTwoConnectorsStaysDistinct(t *testing.T) {
	dirA, dirB := t.TempDir(), t.TempDir()
	if err := os.WriteFile(filepath.Join(dirA, "notes.txt"), []byte("A content"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dirB, "notes.txt"), []byte("B content"), 0o644); err != nil {
		t.Fatal(err)
	}
	lat := newFakeLattice()
	c := NewWithSync(NewMemoryStore(nil), localFolderFactory, lat)
	a, _ := c.Create("p", Actor{ID: "u"}, "A", SubKindLocalFolder)
	a, _ = c.Configure("p", a.ID, dirA)
	b, _ := c.Create("p", Actor{ID: "u"}, "B", SubKindLocalFolder)
	b, _ = c.Configure("p", b.ID, dirB)
	if _, err := c.Sync("p", a.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Sync("p", b.ID); err != nil {
		t.Fatal(err)
	}

	idA := lat.pathToSourceID2(a.ID, "notes.txt")
	idB := lat.pathToSourceID2(b.ID, "notes.txt")
	if idA == "" || idB == "" {
		t.Fatalf("a file is missing: A=%q B=%q (%+v)", idA, idB, lat.label)
	}
	if idA == idB {
		t.Fatalf("the same path in two connectors collapsed to one source id: %q", idA)
	}
	if lat.added[idA] != "A content" || lat.added[idB] != "B content" {
		t.Fatalf("content crossed connectors: A=%q B=%q", lat.added[idA], lat.added[idB])
	}
	// Each id sits under its own connector's prefix, which is what makes a
	// per-connector enumeration exact.
	if !strings.HasPrefix(idA, a.ID+FileSeparator) || !strings.HasPrefix(idB, b.ID+FileSeparator) {
		t.Fatalf("ids are not under their own connector: A=%q B=%q", idA, idB)
	}
	under, err := lat.SourcesUnder("p", a.ID+FileSeparator)
	if err != nil || len(under) != 1 || under[0].SourceID != idA {
		t.Fatalf("SourcesUnder(A) = %+v err=%v, want exactly A's file", under, err)
	}
}

// TestSameBaseNameAtDifferentPathsStaysDistinct is the collision case that
// actually matters within one connector: "src/a.txt" and "docs/a.txt" share a
// base name and are two different files. The registry keys on the provider's
// full key — the relative path, here — so they get two ids and two sources.
//
// Keying on a base name would merge them, and the merge would be silent: one
// file's content would serve under the other's id, and excluding one would
// exclude both.
func TestSameBaseNameAtDifferentPathsStaysDistinct(t *testing.T) {
	dir := t.TempDir()
	for _, sub := range []string{"src", "docs"} {
		if err := os.MkdirAll(filepath.Join(dir, sub), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(dir, "src", "a.txt"), []byte("SRC"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "docs", "a.txt"), []byte("DOCS"), 0o644); err != nil {
		t.Fatal(err)
	}
	lat := newFakeLattice()
	c := NewWithSync(NewMemoryStore(nil), localFolderFactory, lat)
	made, _ := c.Create("p", Actor{ID: "u"}, "d", SubKindLocalFolder)
	made, _ = c.Configure("p", made.ID, dir)
	if _, err := c.Sync("p", made.ID); err != nil {
		t.Fatal(err)
	}

	srcID := lat.pathToSourceID(filepath.Join("src", "a.txt"))
	docsID := lat.pathToSourceID(filepath.Join("docs", "a.txt"))
	if srcID == "" || docsID == "" {
		t.Fatalf("a file is missing: src=%q docs=%q (%+v)", srcID, docsID, lat.label)
	}
	if srcID == docsID {
		t.Fatalf("two paths sharing a base name collapsed to one source: %q", srcID)
	}
	if lat.added[srcID] != "SRC" || lat.added[docsID] != "DOCS" {
		t.Fatalf("content crossed paths: src=%q docs=%q", lat.added[srcID], lat.added[docsID])
	}

	// And the ids survive a re-sync, keyed on the full path rather than the name.
	if _, err := c.Sync("p", made.ID); err != nil {
		t.Fatal(err)
	}
	if got := lat.pathToSourceID(filepath.Join("src", "a.txt")); got != srcID {
		t.Fatalf("src/a.txt changed id across syncs: %q → %q", srcID, got)
	}
	if got := lat.pathToSourceID(filepath.Join("docs", "a.txt")); got != docsID {
		t.Fatalf("docs/a.txt changed id across syncs: %q → %q", docsID, got)
	}
}

// TestFilesListsProviderKeysWithLatticeIDs covers the translation a caller needs:
// it holds a name, every scope selection is by source id, and this is what maps
// one to the other.
func TestFilesListsProviderKeysWithLatticeIDs(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "tower.md"), []byte("T"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "bridge.md"), []byte("B"), 0o644); err != nil {
		t.Fatal(err)
	}
	lat := newFakeLattice()
	c := NewWithSync(NewMemoryStore(nil), localFolderFactory, lat)
	made, _ := c.Create("p", Actor{ID: "u"}, "d", SubKindLocalFolder)
	made, _ = c.Configure("p", made.ID, dir)
	if _, err := c.Sync("p", made.ID); err != nil {
		t.Fatal(err)
	}

	files, err := c.Files("p", made.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 2 {
		t.Fatalf("files = %+v, want 2", files)
	}
	// Sorted by key, so a client rendering the list gets a stable order.
	if files[0].Key != "bridge.md" || files[1].Key != "tower.md" {
		t.Fatalf("files not sorted by key: %+v", files)
	}
	for _, f := range files {
		if f.SourceID != lat.pathToSourceID(f.Key) {
			t.Fatalf("file %q maps to %q, want %q", f.Key, f.SourceID, lat.pathToSourceID(f.Key))
		}
		if !strings.HasPrefix(f.SourceID, made.ID+FileSeparator) {
			t.Fatalf("file %q id is not under its connector: %q", f.Key, f.SourceID)
		}
	}
}

// The point of the skip, measured where it matters: changing one file in a
// connector must not re-add the others. applySync still loops every file — the
// connector has no per-file fingerprint — so this is what keeps the cost of a
// one-file edit from scaling with the size of the connector.
func TestResyncOnlyRewritesTheChangedFile(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"a.txt", "b.txt", "c.txt"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("content of "+name), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	lat := newCountingLattice()
	c := NewWithSync(NewMemoryStore(nil), localFolderFactory, lat)
	made, _ := c.Create("p", Actor{ID: "u1"}, "d", SubKindLocalFolder)
	made, _ = c.Configure("p", made.ID, dir)

	if _, err := c.Sync("p", made.ID); err != nil {
		t.Fatal(err)
	}
	if lat.rewrites != 3 {
		t.Fatalf("first sync rewrote %d sources, want 3 (all new)", lat.rewrites)
	}

	// Change exactly one file.
	lat.rewrites = 0
	if err := os.WriteFile(filepath.Join(dir, "b.txt"), []byte("b.txt has changed"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Sync("p", made.ID); err != nil {
		t.Fatal(err)
	}
	if lat.rewrites != 1 {
		t.Errorf("re-sync rewrote %d sources, want 1 — the two unchanged files were re-clustered for nothing", lat.rewrites)
	}
}

// countingLattice is a fakeLattice that answers AddSources the way the real
// lattice now does: a file whose content matches what is already stored is
// skipped, and only a genuine rewrite is counted.
type countingLattice struct {
	*fakeLattice
	rewrites int
}

func newCountingLattice() *countingLattice { return &countingLattice{fakeLattice: newFakeLattice()} }

func (c *countingLattice) AddSources(projectID string, files []LatticeFileWrite) (Usage, []SkippedFile, error) {
	var changed []LatticeFileWrite
	for _, w := range files {
		if prev, ok := c.added[w.SourceID]; ok && prev == readWrite(w) && c.label[w.SourceID] == w.Label {
			continue // skipped: nothing changed, nothing spent
		}
		c.rewrites++
		changed = append(changed, w)
	}
	if len(changed) == 0 {
		return Usage{}, nil, nil
	}
	return c.fakeLattice.AddSources(projectID, changed)
}

// The rate limit that started all this: a folder's first sync used to make one
// embedding call per file, back to back. Whatever the file count, it is now one.
func TestSyncAdmitsEveryFileInOneCall(t *testing.T) {
	dir := t.TempDir()
	const files = 25
	for i := range files {
		name := fmt.Sprintf("f%02d.txt", i)
		if err := os.WriteFile(filepath.Join(dir, name), []byte("content of "+name), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	lat := newFakeLattice()
	c := NewWithSync(NewMemoryStore(nil), localFolderFactory, lat)
	made, _ := c.Create("p", Actor{ID: "u1"}, "d", SubKindLocalFolder)
	made, _ = c.Configure("p", made.ID, dir)

	if _, err := c.Sync("p", made.ID); err != nil {
		t.Fatal(err)
	}
	if lat.calls != 1 {
		t.Errorf("lattice called %d times for %d files, want 1", lat.calls, files)
	}
	if len(lat.added) != files {
		t.Errorf("admitted %d sources, want %d", len(lat.added), files)
	}
}

// skippingLattice reports one path as unreadable, standing in for a file the
// lattice opened and could not read.
type skippingLattice struct {
	*fakeLattice
	unreadable string
}

func (s *skippingLattice) AddSources(projectID string, files []LatticeFileWrite) (Usage, []SkippedFile, error) {
	var keep []LatticeFileWrite
	var skipped []SkippedFile
	for _, w := range files {
		if w.Label == s.unreadable {
			skipped = append(skipped, SkippedFile{
				Path: w.Label, Code: CodeFileUnreadable, Detail: "permission denied",
			})
			continue
		}
		keep = append(keep, w)
	}
	u, _, err := s.fakeLattice.AddSources(projectID, keep)
	return u, skipped, err
}

// A file the lattice could not read is retried, and the sync does not claim its
// source's fingerprint until it has actually caught up.
//
// The fingerprint is the only thing the detector compares. Recording the current
// one after skipping a file meant the next tick found nothing to do, so the file
// that never arrived was never looked at again — for as long as nothing else in
// the folder changed. It was simply absent from retrieval, and every response was
// a 200.
func TestASkippedFileLeavesTheConnectorBehindItsSource(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"good.txt", "bad.txt"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("content of "+name), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	lat := &skippingLattice{fakeLattice: newFakeLattice(), unreadable: "bad.txt"}
	c := NewWithSync(NewMemoryStore(nil), localFolderFactory, lat)
	made, _ := c.Create("p", Actor{ID: "u1"}, "d", SubKindLocalFolder)
	made, _ = c.Configure("p", made.ID, dir)

	res, err := c.Sync("p", made.ID)
	if err != nil {
		t.Fatalf("sync: %v", err)
	}
	if len(res.Skipped) != 1 || res.Skipped[0].Path != "bad.txt" {
		t.Fatalf("skipped = %+v, want bad.txt", res.Skipped)
	}
	// The readable file still landed: one unusable file is a reason to leave that
	// file out, never to abandon everything beside it.
	if len(lat.added) != 1 {
		t.Errorf("admitted %d source(s), want just the readable one: %+v", len(lat.added), lat.label)
	}

	after, err := c.store.ConnectorByID("p", made.ID)
	if err != nil {
		t.Fatal(err)
	}
	snap, _ := NewLocalFolderProvider(dir).Snapshot()
	if after.Fingerprint == snap.Fingerprint {
		t.Error("the connector claimed its source's fingerprint while a file was still missing")
	}
	// And the retry is paced rather than immediate, or the detector would re-read
	// the folder every tick at provider rates.
	if after.FailedAttempts == 0 {
		t.Error("a skip did not count as an attempt, so the retry is unbounded")
	}
	if after.LastError == "" || !strings.Contains(after.LastError, "bad.txt") {
		t.Errorf("LastError = %q, want it to name bad.txt", after.LastError)
	}
}

// A sync that skips nothing does claim the fingerprint, so the common case stays
// free: an unchanged folder costs one comparison and no reads.
func TestACleanSyncClaimsTheFingerprint(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("alpha"), 0o644); err != nil {
		t.Fatal(err)
	}
	lat := newFakeLattice()
	c := NewWithSync(NewMemoryStore(nil), localFolderFactory, lat)
	made, _ := c.Create("p", Actor{ID: "u1"}, "d", SubKindLocalFolder)
	made, _ = c.Configure("p", made.ID, dir)

	if _, err := c.Sync("p", made.ID); err != nil {
		t.Fatal(err)
	}
	after, _ := c.store.ConnectorByID("p", made.ID)
	snap, _ := NewLocalFolderProvider(dir).Snapshot()
	if after.Fingerprint != snap.Fingerprint {
		t.Errorf("fingerprint = %q, want the source's %q", after.Fingerprint, snap.Fingerprint)
	}
	if after.FailedAttempts != 0 {
		t.Errorf("a clean sync counted %d failed attempt(s)", after.FailedAttempts)
	}

	// The next detector tick finds nothing to do.
	res, err := c.SyncIfChanged("p", made.ID)
	if err != nil {
		t.Fatal(err)
	}
	if res.Changed {
		t.Error("an unchanged folder re-synced")
	}
}

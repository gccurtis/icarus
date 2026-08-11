package connector

import (
	"crypto/sha256"
	"encoding/hex"
	"io"
	"os"
	"path/filepath"
	"testing"
)

func TestLocalFolderSnapshotTracksFilesAndFingerprint(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("alpha"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "b.txt"), []byte("beta"), 0o644); err != nil {
		t.Fatal(err)
	}

	p := NewLocalFolderProvider(dir)
	s1, err := p.Snapshot()
	if err != nil {
		t.Fatalf("snapshot: %v", err)
	}
	if len(s1.Files) == 0 || s1.Fingerprint == "" {
		t.Fatalf("empty snapshot: %+v", s1)
	}
	// Stable when nothing changes.
	s2, _ := p.Snapshot()
	if s1.Fingerprint != s2.Fingerprint {
		t.Fatal("fingerprint changed with no edit")
	}
	// Moves when content changes.
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("ALPHA"), 0o644); err != nil {
		t.Fatal(err)
	}
	s3, _ := p.Snapshot()
	if s3.Fingerprint == s1.Fingerprint {
		t.Fatal("fingerprint did not change after edit")
	}
	// The changed content is reflected in the per-file entries.
	if s3.Files[0].Hash == s1.Files[0].Hash {
		t.Fatal("per-file hash did not change after edit")
	}
}

func TestLocalFolderSnapshotWalksRecursivelyIntoFiles(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("alpha"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "sub"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "sub", "b.txt"), []byte("beta"), 0o644); err != nil {
		t.Fatal(err)
	}

	p := NewLocalFolderProvider(dir)
	s1, err := p.Snapshot()
	if err != nil {
		t.Fatalf("snapshot: %v", err)
	}
	if len(s1.Files) != 2 {
		t.Fatalf("want 2 files, got %d: %+v", len(s1.Files), s1.Files)
	}
	if s1.Files[0].Path != "a.txt" || readEntry(t, s1.Files[0]) != "alpha" {
		t.Fatalf("want a.txt/alpha first, got %+v", s1.Files[0])
	}
	if s1.Files[1].Path != "sub/b.txt" || readEntry(t, s1.Files[1]) != "beta" {
		t.Fatalf("want sub/b.txt/beta second, got %+v", s1.Files[1])
	}
	if s1.Fingerprint == "" {
		t.Fatal("empty fingerprint")
	}

	// Fingerprint moves when a nested file's content changes.
	if err := os.WriteFile(filepath.Join(dir, "sub", "b.txt"), []byte("BETA"), 0o644); err != nil {
		t.Fatal(err)
	}
	s2, err := p.Snapshot()
	if err != nil {
		t.Fatalf("snapshot: %v", err)
	}
	if s2.Fingerprint == s1.Fingerprint {
		t.Fatal("fingerprint did not change after nested edit")
	}
}

// readEntry is what a caller does with a listing: open one file and read it.
func readEntry(t *testing.T, f FileEntry) string {
	t.Helper()
	rc, err := f.Open()
	if err != nil {
		t.Fatalf("open %q: %v", f.Path, err)
	}
	defer rc.Close()
	b, err := io.ReadAll(rc)
	if err != nil {
		t.Fatalf("read %q: %v", f.Path, err)
	}
	return string(b)
}

// A listing carries no content, and the hash is what tells a caller whether it
// needs any. This is the property the whole streaming change rests on: an
// unchanged connector must be answerable without reading a single file's bytes
// into the caller.
func TestLocalFolderListingCarriesHashesNotContent(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("alpha"), 0o644); err != nil {
		t.Fatal(err)
	}
	snap, err := NewLocalFolderProvider(dir).Snapshot()
	if err != nil {
		t.Fatalf("snapshot: %v", err)
	}
	got := snap.Files[0]
	if got.Size != 5 {
		t.Errorf("size = %d, want 5", got.Size)
	}
	// The same value knowledge.ContentHash produces, because the two are compared
	// directly to decide whether a source changed.
	sum := sha256.Sum256([]byte("alpha"))
	if want := hex.EncodeToString(sum[:]); got.Hash != want {
		t.Errorf("hash = %q, want %q", got.Hash, want)
	}
	if body := readEntry(t, got); body != "alpha" {
		t.Errorf("opened content = %q, want %q", body, "alpha")
	}
}

// An opener stays valid for as long as the caller holds the snapshot. Ingest
// lists first and reads later — slices apart, in the general case — so an opener
// bound to the walk's transient state would fail exactly on the large syncs this
// design exists to serve.
func TestLocalFolderOpenersOutliveTheWalk(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{"a.txt", "b.txt", "c.txt"} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("body of "+name), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	snap, err := NewLocalFolderProvider(dir).Snapshot()
	if err != nil {
		t.Fatalf("snapshot: %v", err)
	}
	// Read them in reverse, well after the walk returned.
	for i := len(snap.Files) - 1; i >= 0; i-- {
		f := snap.Files[i]
		if want := "body of " + f.Path; readEntry(t, f) != want {
			t.Errorf("%s opened to %q, want %q", f.Path, readEntry(t, f), want)
		}
	}
}

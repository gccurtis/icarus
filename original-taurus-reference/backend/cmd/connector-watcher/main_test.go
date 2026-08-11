package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func seedFolder(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("hello world"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "sub"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "sub", "b.txt"), []byte("nested content"), 0o644); err != nil {
		t.Fatal(err)
	}
	return dir
}

// The listing is NDJSON — one object per line — and carries metadata only. The
// absence of content is the property worth pinning: as a single document with
// content inline, the watcher buffered the whole folder to encode it and Omega
// buffered it again to decode, on every detector tick, changed or not.
func TestSnapshotHandlerServesAnNDJSONListingWithoutContent(t *testing.T) {
	dir := seedFolder(t)

	rec := httptest.NewRecorder()
	snapshotHandler(dir)(rec, httptest.NewRequest(http.MethodGet, "/snapshot", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/x-ndjson" {
		t.Errorf("Content-Type = %q, want application/x-ndjson", ct)
	}
	if strings.Contains(rec.Body.String(), "hello world") {
		t.Errorf("the listing carried file content:\n%s", rec.Body.String())
	}

	byPath := map[string]snapshotLine{}
	dec := json.NewDecoder(rec.Body)
	for {
		var line snapshotLine
		if err := dec.Decode(&line); err == io.EOF {
			break
		} else if err != nil {
			t.Fatalf("decode: %v", err)
		}
		byPath[line.Path] = line
	}
	if len(byPath) != 2 {
		t.Fatalf("expected 2 files, got %d: %+v", len(byPath), byPath)
	}
	if got := byPath["a.txt"]; got.Size != 11 || got.Hash == "" {
		t.Errorf("a.txt = %+v, want size 11 and a hash", got)
	}
	if got := byPath["sub/b.txt"]; got.Size != 14 || got.Hash == "" {
		t.Errorf("sub/b.txt = %+v, want size 14 and a hash", got)
	}
	if byPath["a.txt"].Hash == byPath["sub/b.txt"].Hash {
		t.Error("two different files share a hash")
	}
}

func TestFileHandlerStreamsOneFile(t *testing.T) {
	dir := seedFolder(t)
	rec := httptest.NewRecorder()
	fileHandler(dir)(rec, httptest.NewRequest(http.MethodGet, "/file?path=sub%2Fb.txt", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d: %s", rec.Code, rec.Body.String())
	}
	if rec.Body.String() != "nested content" {
		t.Errorf("body = %q", rec.Body.String())
	}
}

// A file listed and then deleted is ordinary for an external source, so it is a
// 404 rather than a 500 — the caller treats it as "this file is gone", not "the
// watcher is broken".
func TestFileHandlerReportsAMissingFileAsNotFound(t *testing.T) {
	rec := httptest.NewRecorder()
	fileHandler(seedFolder(t))(rec, httptest.NewRequest(http.MethodGet, "/file?path=gone.txt", nil))
	if rec.Code != http.StatusNotFound {
		t.Errorf("code %d, want 404", rec.Code)
	}
}

// The watcher is pointed at one directory and serves that directory. Without
// confining the path, a query parameter reads anything the process can — and the
// process is pointed at a user's own machine.
func TestFileHandlerRefusesToEscapeTheWatchedFolder(t *testing.T) {
	dir := seedFolder(t)
	outside := filepath.Join(filepath.Dir(dir), "outside.txt")
	if err := os.WriteFile(outside, []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}
	defer os.Remove(outside)

	for _, attempt := range []string{
		"../outside.txt",
		"sub/../../outside.txt",
		"/etc/passwd",
	} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/file?path="+attempt, nil)
		fileHandler(dir)(rec, req)
		if rec.Code == http.StatusOK {
			t.Errorf("%q escaped the watched folder: %q", attempt, rec.Body.String())
		}
	}
}

// A directory symlink inside the watched folder does not extend it.
//
// This is what a lexical path check misses: the request never mentions "..", so
// every amount of string comparison passes it, and the watcher would serve the
// symlink target's whole subtree. The watcher is pointed at a directory on
// someone's own machine, so "its whole subtree" is the wrong amount of trust.
func TestFileHandlerDoesNotFollowASymlinkOutOfTheFolder(t *testing.T) {
	dir := seedFolder(t)
	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "secret.txt"), []byte("private"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(dir, "escape")); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}

	rec := httptest.NewRecorder()
	fileHandler(dir)(rec, httptest.NewRequest(http.MethodGet, "/file?path=escape%2Fsecret.txt", nil))
	if rec.Code == http.StatusOK {
		t.Errorf("served a file through a directory symlink: %q", rec.Body.String())
	}
}

// A file symlink pointing outside is refused for the same reason.
func TestFileHandlerDoesNotFollowAFileSymlinkOutOfTheFolder(t *testing.T) {
	dir := seedFolder(t)
	outside := filepath.Join(t.TempDir(), "secret.txt")
	if err := os.WriteFile(outside, []byte("private"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(dir, "link.txt")); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}

	rec := httptest.NewRecorder()
	fileHandler(dir)(rec, httptest.NewRequest(http.MethodGet, "/file?path=link.txt", nil))
	if rec.Code == http.StatusOK {
		t.Errorf("served a file through a symlink: %q", rec.Body.String())
	}
}

// The length is declared, which is what lets a client detect a body that stopped
// early. Without it a copy failing halfway delivers a short body under a 200, and
// a half-read file windows and embeds perfectly well — so it is indexed and cited
// as though it were whole.
func TestFileHandlerDeclaresTheLength(t *testing.T) {
	dir := seedFolder(t)
	rec := httptest.NewRecorder()
	fileHandler(dir)(rec, httptest.NewRequest(http.MethodGet, "/file?path=a.txt", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("code %d", rec.Code)
	}
	if got := rec.Header().Get("Content-Length"); got != "11" {
		t.Errorf("Content-Length = %q, want %q", got, "11")
	}
}

// A directory is not a file, and asking for one must not produce a 200 with a
// body of whatever os.Open on a directory yields.
func TestFileHandlerRefusesADirectory(t *testing.T) {
	rec := httptest.NewRecorder()
	fileHandler(seedFolder(t))(rec, httptest.NewRequest(http.MethodGet, "/file?path=sub", nil))
	if rec.Code == http.StatusOK {
		t.Errorf("served a directory: %q", rec.Body.String())
	}
}

package file

import (
	"bytes"
	"errors"
	"testing"
	"time"

	"github.com/gccurtis/taurus-omega/core/platform/limit"
)

// stepClock returns a now() that advances one second per call, so uploads get
// strictly increasing timestamps for deterministic newest-first ordering.
func stepClock() func() time.Time {
	base := time.Unix(1_700_000_000, 0).UTC()
	n := 0
	return func() time.Time {
		n++
		return base.Add(time.Duration(n) * time.Second)
	}
}

func newFiles(t *testing.T, maxSize int64) *Files {
	t.Helper()
	f, err := New(NewMemoryStore(), maxSize)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	return f
}

func TestUploadMetaDownloadRoundTrip(t *testing.T) {
	files := newFiles(t, 0)
	scope := Scope{ProjectID: "p1"}
	content := []byte("hello, attachment")

	up, err := files.Upload(scope, "notes.txt", "text/plain", content, "u1", "Ann")
	if err != nil {
		t.Fatalf("Upload: %v", err)
	}
	if up.Size != int64(len(content)) || up.ContentType != "text/plain" {
		t.Errorf("meta wrong: %+v", up)
	}
	if up.UploaderID != "u1" || up.UploaderName != "Ann" {
		t.Errorf("uploader not recorded: %+v", up)
	}

	meta, err := files.Meta(scope, up.ID)
	if err != nil || meta.ID != up.ID {
		t.Fatalf("Meta: %v (%+v)", err, meta)
	}

	gotMeta, gotContent, err := files.Download(scope, up.ID)
	if err != nil {
		t.Fatalf("Download: %v", err)
	}
	if gotMeta.ID != up.ID || !bytes.Equal(gotContent, content) {
		t.Errorf("download mismatch: meta=%+v content=%q", gotMeta, gotContent)
	}
}

func TestUploadDefaultsContentType(t *testing.T) {
	files := newFiles(t, 0)
	up, err := files.Upload(Scope{ProjectID: "p1"}, "blob", "", []byte("x"), "u1", "")
	if err != nil {
		t.Fatalf("Upload: %v", err)
	}
	if up.ContentType != "application/octet-stream" {
		t.Errorf("default content type wrong: %q", up.ContentType)
	}
	if up.UploaderName != "u1" { // name falls back to id
		t.Errorf("uploader name fallback wrong: %q", up.UploaderName)
	}
}

func TestUploadSizeCapRejected(t *testing.T) {
	files := newFiles(t, 8) // 8-byte cap
	_, err := files.Upload(Scope{ProjectID: "p1"}, "big.bin", "application/octet-stream", []byte("123456789"), "u1", "Ann")
	if !errors.Is(err, ErrTooLarge) {
		t.Errorf("want ErrTooLarge, got %v", err)
	}
	// At the cap is allowed.
	if _, err := files.Upload(Scope{ProjectID: "p1"}, "ok.bin", "application/octet-stream", []byte("12345678"), "u1", "Ann"); err != nil {
		t.Errorf("at-cap upload should pass, got %v", err)
	}
}

// The size failure has to answer to BOTH identities, and this is the assertion that
// keeps them together. Enriching an error is exactly where an errors.Is check that
// used to match silently stops matching — so the sentinel is asserted alongside the
// numbers rather than replaced by them.
func TestUploadSizeCapCarriesTheArithmetic(t *testing.T) {
	files := newFiles(t, 8)
	_, err := files.Upload(Scope{ProjectID: "p1"}, "big.bin", "application/octet-stream", []byte("123456789"), "u1", "Ann")

	if !errors.Is(err, ErrTooLarge) {
		t.Fatalf("the sentinel must survive: err = %v", err)
	}
	e, ok := limit.From(err)
	if !ok {
		t.Fatalf("err = %v (%T), want a limit a handler can report", err, err)
	}
	if e.Code != CodeTooLarge {
		t.Errorf("code = %q, want %q", e.Code, CodeTooLarge)
	}
	if e.Limit != 8 || e.Actual != 9 {
		t.Errorf("limit/actual = %d/%d, want 8/9", e.Limit, e.Actual)
	}
	// The subject names which file, which is what a batch upload needs in order to
	// report one member's failure.
	if e.Subject != "big.bin" {
		t.Errorf("subject = %q, want big.bin", e.Subject)
	}
}

func TestUploadValidation(t *testing.T) {
	files := newFiles(t, 0)
	if _, err := files.Upload(Scope{}, "n", "text/plain", []byte("x"), "u1", "A"); !errors.Is(err, ErrInvalidScope) {
		t.Errorf("empty scope: want ErrInvalidScope, got %v", err)
	}
	if _, err := files.Upload(Scope{ProjectID: "p1"}, "", "text/plain", []byte("x"), "u1", "A"); !errors.Is(err, ErrInvalid) {
		t.Errorf("empty name: want ErrInvalid, got %v", err)
	}
	if _, err := files.Upload(Scope{ProjectID: "p1"}, "n", "text/plain", nil, "u1", "A"); !errors.Is(err, ErrInvalid) {
		t.Errorf("empty content: want ErrInvalid, got %v", err)
	}
}

func TestCrossProjectIsolation(t *testing.T) {
	files := newFiles(t, 0)
	up, _ := files.Upload(Scope{ProjectID: "p1"}, "secret.txt", "text/plain", []byte("mine"), "u1", "Ann")

	other := Scope{ProjectID: "p2"}
	if _, err := files.Meta(other, up.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("cross-project Meta: want ErrNotFound, got %v", err)
	}
	if _, _, err := files.Download(other, up.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("cross-project Download: want ErrNotFound, got %v", err)
	}
}

// TestStoreReadsAreProjectScoped pins DEF-1: the Store's by-id reads carry the
// project label themselves, so a foreign project is refused at the store rather
// than relying on the caller having checked the metadata first. Content in
// particular used to return unlabeled bytes that could not self-verify.
func TestStoreReadsAreProjectScoped(t *testing.T) {
	store := NewMemoryStore()
	files, err := New(store, 0)
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	content := []byte("mine")
	up, err := files.Upload(Scope{ProjectID: "p1"}, "secret.txt", "text/plain", content, "u1", "Ann")
	if err != nil {
		t.Fatalf("Upload: %v", err)
	}

	// The owning project still reads its bytes and metadata.
	got, err := store.Content("p1", up.ID)
	if err != nil || !bytes.Equal(got, content) {
		t.Fatalf("owning-project Content = %q, %v; want %q", got, err, content)
	}
	if meta, err := store.Meta("p1", up.ID); err != nil || meta.ID != up.ID {
		t.Fatalf("owning-project Meta = %+v, %v", meta, err)
	}

	// A foreign project gets not-found, not bytes.
	if got, err := store.Content("p2", up.ID); !errors.Is(err, ErrNotFound) || got != nil {
		t.Errorf("foreign-project Content = %q, %v; want nil, ErrNotFound", got, err)
	}
	if meta, err := store.Meta("p2", up.ID); !errors.Is(err, ErrNotFound) {
		t.Errorf("foreign-project Meta = %+v, %v; want ErrNotFound", meta, err)
	}
}

func TestListNewestFirst(t *testing.T) {
	files := newFiles(t, 0)
	scope := Scope{ProjectID: "p1"}
	// Stamp increasing timestamps so ordering is deterministic.
	files.now = stepClock()
	a, _ := files.Upload(scope, "a", "text/plain", []byte("a"), "u1", "Ann")
	b, _ := files.Upload(scope, "b", "text/plain", []byte("b"), "u1", "Ann")
	files.Upload(Scope{ProjectID: "p2"}, "other", "text/plain", []byte("o"), "u1", "Ann")

	list, err := files.List(scope)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(list) != 2 || list[0].ID != b.ID || list[1].ID != a.ID {
		t.Fatalf("want [b, a] newest-first, got %+v", list)
	}
}

package connector

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"

	"testing"
)

// The listing is NDJSON, and it carries no content: the wire format cannot
// express it, so nothing downstream can come to depend on it.
func TestHTTPProviderReadsAnNDJSONListing(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/snapshot":
			enc := json.NewEncoder(w)
			// Deliberately out of path order, to prove the fingerprint does not depend
			// on the order the provider happened to enumerate in.
			_ = enc.Encode(map[string]any{"path": "sub/b.txt", "size": 6, "hash": "hb"})
			_ = enc.Encode(map[string]any{"path": "a.txt", "size": 6, "hash": "ha"})
		case r.URL.Path == "/file" && r.URL.Query().Get("path") == "a.txt":
			_, _ = w.Write([]byte("file a"))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	snap, err := NewHTTPProvider(srv.URL).Snapshot()
	if err != nil {
		t.Fatalf("Snapshot: %v", err)
	}
	if len(snap.Files) != 2 {
		t.Fatalf("got %d files, want 2: %+v", len(snap.Files), snap.Files)
	}
	if snap.Files[0].Path != "a.txt" || snap.Files[1].Path != "sub/b.txt" {
		t.Errorf("listing not sorted by path: %+v", snap.Files)
	}
	if snap.Files[0].Size != 6 || snap.Files[0].Hash != "ha" {
		t.Errorf("metadata lost: %+v", snap.Files[0])
	}
	// Derived from the listing, not sent, so the two sides cannot disagree about
	// what a fingerprint is.
	if want := FingerprintOf(snap.Files); snap.Fingerprint != want {
		t.Errorf("fingerprint = %q, want the derived %q", snap.Fingerprint, want)
	}

	// Content arrives only when asked for, one file at a time.
	rc, err := snap.Files[0].Open()
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer rc.Close()
	b, _ := io.ReadAll(rc)
	if string(b) != "file a" {
		t.Errorf("read %q, want %q", b, "file a")
	}
}

// A file listed and then gone is an ordinary outcome for an external source, so
// it surfaces as an error from the opener rather than poisoning the listing.
func TestHTTPProviderReportsAVanishedFile(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/snapshot" {
			_ = json.NewEncoder(w).Encode(map[string]any{"path": "gone.txt", "size": 1, "hash": "h"})
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	snap, err := NewHTTPProvider(srv.URL).Snapshot()
	if err != nil {
		t.Fatalf("Snapshot: %v", err)
	}
	if _, err := snap.Files[0].Open(); err == nil {
		t.Error("want an error opening a file the watcher no longer has")
	}
}

func TestHTTPProviderErrorsOnBadStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	if _, err := NewHTTPProvider(srv.URL).Snapshot(); err == nil {
		t.Fatal("expected an error on a non-200 provider response")
	}
}

// A 200 carrying some other JSON object must not decode as a listing.
//
// encoding/json accepts any object here and leaves unmatched fields zero, so a
// health page, a proxy's error body, or a half-deployed watcher answering
// {"error":"..."} decoded cleanly into ONE entry with an empty path. applySync
// builds its prune set from the listing, so that single entry would have deleted
// every source the connector owns — and the sync would have reported success.
func TestHTTPProviderRefusesAListingEntryWithoutAPath(t *testing.T) {
	for name, body := range map[string]string{
		"error object":  `{"error":"the watcher is not ready"}`,
		"empty object":  `{}`,
		"missing path":  `{"size":10,"hash":"abc"}`,
		"blank path":    `{"path":"","size":10,"hash":"abc"}`,
		"good then bad": "{\"path\":\"a.txt\",\"size\":1,\"hash\":\"h\"}\n{\"error\":\"boom\"}",
	} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte(body))
		}))
		if _, err := NewHTTPProvider(srv.URL).Snapshot(); err == nil {
			t.Errorf("%s: want an error, got a usable snapshot", name)
		}
		srv.Close()
	}
}

// A watcher that accepts the connection and never answers must not hold the
// caller forever. The listing has a total deadline; the file read has one on the
// response headers, so a hung watcher fails while a slow large body does not.
func TestHTTPProviderFileReadDoesNotHangForever(t *testing.T) {
	block := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/snapshot" {
			_ = json.NewEncoder(w).Encode(map[string]any{"path": "a.txt", "size": 1, "hash": "h"})
			return
		}
		<-block // never answers
	}))
	defer func() { close(block); srv.Close() }()

	p := NewHTTPProvider(srv.URL)
	snap, err := p.Snapshot()
	if err != nil {
		t.Fatalf("Snapshot: %v", err)
	}
	// The deadline is 30s, far longer than a test should wait, so this asserts the
	// shape rather than the duration: the client must carry a header timeout at all.
	hp, ok := p.(httpProvider)
	if !ok {
		t.Fatalf("unexpected provider type %T", p)
	}
	tr, ok := hp.reader.Transport.(*http.Transport)
	if !ok {
		t.Fatal("the file reader has no transport, so it has no header deadline")
	}
	if tr.ResponseHeaderTimeout <= 0 {
		t.Error("the file reader has no ResponseHeaderTimeout; a hung watcher would wedge the detector")
	}
	if hp.reader.Timeout != 0 {
		t.Errorf("the file reader has a total deadline of %s, which would truncate a large body mid-stream",
			hp.reader.Timeout)
	}
	_ = snap
}

package connector

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// httpProvider talks to an external watcher over HTTP. Change detection and
// source access live in the watcher process, not in Omega: GET
// {endpoint}/snapshot lists the source, and GET {endpoint}/file?path=… reads one
// member of it.
//
// The listing is NDJSON — one JSON object per line — so neither side has to hold
// the whole thing. That matters more than it looks: as a single document, a
// folder of 100k files meant the watcher buffering the entire listing to encode
// it and Omega buffering it again to decode, and when the listing still carried
// content it was the whole corpus, twice, on every detector tick.
type httpProvider struct {
	endpoint string
	// client fetches the listing under a total deadline; reader fetches one file
	// under a header deadline only. Two clients because the two requests fail
	// differently — see NewHTTPProvider.
	client *http.Client
	reader *http.Client
}

// NewHTTPProvider returns a Provider that polls the watcher at endpoint.
//
// Both requests are bounded, but by different things.
//
// A listing is metadata and should be quick, so it gets a total deadline: ten
// seconds for the whole exchange.
//
// A file read gets a deadline on the RESPONSE HEADERS and none on the body. That
// distinction is the point. A watcher that accepts a connection and never answers
// is broken and must not be allowed to hold the detector — that is what the header
// deadline catches. But a genuinely large file legitimately takes as long as it
// takes, and a total deadline would cut its body off mid-stream, which is the
// worst outcome available here: a truncated file windows and embeds perfectly
// well, so it would be indexed as complete and cited as complete.
func NewHTTPProvider(endpoint string) Provider {
	return httpProvider{
		endpoint: strings.TrimRight(endpoint, "/"),
		client:   &http.Client{Timeout: 10 * time.Second},
		reader: &http.Client{Transport: &http.Transport{
			ResponseHeaderTimeout: 30 * time.Second,
		}},
	}
}

// snapshotLine is one line of the listing. Content is absent by construction —
// the wire format cannot carry it, so no caller can come to depend on it.
type snapshotLine struct {
	Path string `json:"path"`
	Size int64  `json:"size"`
	Hash string `json:"hash"`
}

func (p httpProvider) Snapshot() (Snapshot, error) {
	resp, err := p.client.Get(p.endpoint + "/snapshot")
	if err != nil {
		return Snapshot{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return Snapshot{}, fmt.Errorf("connector provider %s: status %d", p.endpoint, resp.StatusCode)
	}

	var files []FileEntry
	dec := json.NewDecoder(resp.Body)
	for {
		var line snapshotLine
		if err := dec.Decode(&line); err == io.EOF {
			break
		} else if err != nil {
			return Snapshot{}, fmt.Errorf("connector provider %s: %w", p.endpoint, err)
		}
		// A line without a path is a malformed listing, and it has to be an error
		// rather than an entry.
		//
		// This is the shape that makes it dangerous: encoding/json accepts ANY JSON
		// object here and simply leaves unmatched fields at their zero values. So a
		// watcher answering 200 with {"error":"..."} — a health page, a proxy's error
		// body, a half-deployed version — decodes cleanly into one entry with an empty
		// path. applySync builds its `want` set from the listing and prunes everything
		// absent from it, so that single bogus entry would delete every source the
		// connector owns. Nothing would report it: the sync would succeed.
		if line.Path == "" {
			return Snapshot{}, fmt.Errorf("connector provider %s: listing entry has no path", p.endpoint)
		}
		path := line.Path
		files = append(files, FileEntry{
			Path: path, Size: line.Size, Hash: line.Hash,
			Open: func() (io.ReadCloser, error) { return p.open(path) },
		})
	}
	// The fingerprint is derived here rather than sent, so there is one definition
	// of what a fingerprint is and no way for the two sides to disagree about it.
	// The listing arrives in the watcher's order; sorting makes the derivation
	// independent of that.
	sortByPath(files)
	return Snapshot{Files: files, Fingerprint: FingerprintOf(files)}, nil
}

// open streams one file from the watcher. A 404 means the file went away between
// the listing and the read, which is an ordinary outcome for an external source.
//
// It bounds how long the watcher may take to START answering, but not how long
// the body may take to arrive. Those are different failures: a watcher that
// accepts a connection and never responds is broken and must not hold the
// detector, while a genuinely large file legitimately takes as long as it takes
// and a total deadline would truncate it mid-stream — silently, since a
// half-read file windows perfectly well.
//
// This used the package-level http.Get, which has no deadline of any kind. One
// unresponsive watcher would have wedged that connector's detector forever.
func (p httpProvider) open(path string) (io.ReadCloser, error) {
	return p.openItem(context.Background(), path, "")
}

func (p httpProvider) OpenItem(ctx context.Context, _ AuthorizedBinding, providerItemID, expectedVersion string) (io.ReadCloser, ItemMeta, error) {
	rc, err := p.openItem(ctx, providerItemID, expectedVersion)
	if err != nil {
		return nil, ItemMeta{}, err
	}
	// Watchers that do not publish a version remain safe: Resource hashes the
	// returned bytes and checks expectedVersion before exposing them.
	return rc, ItemMeta{}, nil
}

func (p httpProvider) openItem(ctx context.Context, path, expectedVersion string) (io.ReadCloser, error) {
	endpoint := p.endpoint + "/file?path=" + url.QueryEscape(path)
	if expectedVersion != "" {
		endpoint += "&version=" + url.QueryEscape(expectedVersion)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	resp, err := p.reader.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		if resp.StatusCode == http.StatusNotFound {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("connector provider %s: reading %q: status %d", p.endpoint, path, resp.StatusCode)
	}
	return resp.Body, nil
}

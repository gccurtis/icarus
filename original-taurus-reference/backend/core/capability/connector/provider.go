package connector

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"sort"
	"strings"
)

// AuthorizedBinding is the trusted connector identity that composition has
// already resolved inside a Project. Provider item readers never receive a
// model-supplied endpoint, object key namespace, or credential.
type AuthorizedBinding struct {
	ProjectID   string
	ConnectorID string
}

// ItemMeta identifies the exact provider item bytes returned by a point read.
// ContentHash is the preferred version when the provider can supply one.
type ItemMeta struct {
	Version     string
	ContentHash string
}

// ConnectorItemReader opens exactly one provider item. It is deliberately
// separate from Provider.Snapshot: exact reading must not enumerate a whole
// connection just to open a file the caller already identified.
type ConnectorItemReader interface {
	OpenItem(ctx context.Context, binding AuthorizedBinding, providerItemID, expectedVersion string) (io.ReadCloser, ItemMeta, error)
}

// FileEntry is one file a connector's source exposes: a path relative to the
// connector root (slash-separated), its size, a hash of its content, and a way
// to read that content.
//
// It carries an opener rather than the content itself. A snapshot used to be
// every byte of every file held at once — and held more than once over, since
// applySync built a parallel slice of writes before admitting any of them —
// which put a hard ceiling on what a connector could hold, and is the reason a
// per-file byte cap existed at all. Now a snapshot is a listing, and content is
// read one file at a time, only for the files that need it.
//
// Hash is what makes "only the files that need it" possible. A re-sync compares
// it against the stored source's content hash and skips a match without opening
// the file at all.
type FileEntry struct {
	Path string
	Size int64
	// Hash is the hex SHA-256 of the file's content — the same value
	// knowledge.ContentHash produces for the same bytes, because the two are
	// compared directly. A provider that cannot compute one leaves it empty,
	// which simply means every file is read.
	Hash string
	// Open reads the file's current content. It may fail, and may return
	// different bytes than Hash describes: the source is external and can change
	// between the listing and the read. Both are ordinary outcomes, not violated
	// invariants.
	Open func() (io.ReadCloser, error)
}

// Snapshot is a provider's current listing plus a fingerprint that changes iff
// any file's path, size or content changes.
type Snapshot struct {
	Files       []FileEntry
	Fingerprint string
}

// Provider is the seam to an external source. The local-folder provider reads a
// directory; a companion watcher program or a real cloud provider satisfies the
// same contract.
type Provider interface {
	Snapshot() (Snapshot, error)
}

// FingerprintOf derives a snapshot fingerprint from a listing: the one
// definition, so every provider agrees and a fingerprint means the same thing
// whichever side of the wire computed it.
//
// It hashes path, size and content hash per file, in path order, which is why
// the entries must already be sorted. Content itself is deliberately absent —
// hashing it here would mean reading every file to answer "did anything change",
// which is the cost this whole change exists to remove.
//
// The value differs from the one the pre-streaming implementation produced, so
// every existing connector sees one changed fingerprint after upgrading. That
// costs a single reconciling sync in which every file's hash matches and every
// file is skipped: no provider call, no tokens.
func FingerprintOf(files []FileEntry) string {
	h := sha256.New()
	for _, f := range files {
		fmt.Fprintf(h, "%s\x00%d\x00%s\x00", f.Path, f.Size, f.Hash)
	}
	return hex.EncodeToString(h.Sum(nil))
}

// sortByPath orders a listing so a fingerprint derived from it is stable
// whatever order the provider enumerated in.
func sortByPath(files []FileEntry) {
	sort.Slice(files, func(i, j int) bool { return files[i].Path < files[j].Path })
}

// TextEntry builds a listing entry from content already in memory — for tests,
// and for any provider whose source is not a file.
func TextEntry(path, content string) FileEntry {
	sum := sha256.Sum256([]byte(content))
	return FileEntry{
		Path: path,
		Size: int64(len(content)),
		Hash: hex.EncodeToString(sum[:]),
		Open: func() (io.ReadCloser, error) { return io.NopCloser(strings.NewReader(content)), nil },
	}
}

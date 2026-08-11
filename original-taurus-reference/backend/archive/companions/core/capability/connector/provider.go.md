# provider.go

The `Provider` seam to an external source. `Snapshot` returns the source's
current content **per file** (`Files`) plus a fingerprint that changes iff any
file's path or content changes, so the connector compares fingerprints to
decide whether a re-sync is needed. The local-folder provider satisfies this
today; a companion-watcher program or a real cloud provider satisfies the same
contract later. See repo conventions (AGENTS.md).

## Code breakdown

```go
package connector

// FileEntry is one file a connector's source exposes: a path relative to the
// connector root (slash-separated) and its content.
type FileEntry struct {
	Path    string
	Content string
}

// Snapshot is a provider's current per-file content plus a fingerprint that
// changes iff any file's path or content changes.
type Snapshot struct {
	Files       []FileEntry
	Fingerprint string
}

// Provider is the seam to an external source. The local-folder provider reads a
// directory; a companion-watcher-program or a real cloud provider satisfies the
// same contract later.
type Provider interface {
	Snapshot() (Snapshot, error)
}
```

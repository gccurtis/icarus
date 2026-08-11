# localfolder.go

The `local-folder` provider: recursively walks a local directory (all regular
files at any depth, path-sorted) and returns each as a `FileEntry` with a path
relative to the root (slash-separated) alongside its content. The fingerprint
is a SHA-256 over each file's relative path, length, and bytes, so it moves
iff the folder's content changes anywhere in the tree. For the proto this
reads the directory in-process — a stand-in for the companion-watcher
program, which satisfies the same `Provider` contract later. See repo
conventions (AGENTS.md).

## Code breakdown

```go
package connector

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
)

type localFolder struct{ path string }

// NewLocalFolderProvider reads a local directory (recursive over regular
// files, path-sorted) as the connector's content. For the proto this reads
// the directory in-process; a companion-watcher-program provider satisfies
// the same Provider contract later.
func NewLocalFolderProvider(path string) Provider { return localFolder{path: path} }

func (l localFolder) Snapshot() (Snapshot, error) {
	var files []FileEntry
	err := filepath.WalkDir(l.path, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(l.path, p)
		if err != nil {
			return err
		}
		files = append(files, FileEntry{Path: filepath.ToSlash(rel), Content: string(b)})
		return nil
	})
	if err != nil {
		return Snapshot{}, err
	}
	sort.Slice(files, func(i, j int) bool { return files[i].Path < files[j].Path })
	h := sha256.New()
	for _, f := range files {
		fmt.Fprintf(h, "%s\x00%d\x00", f.Path, len(f.Content))
		io.WriteString(h, f.Content)
	}
	return Snapshot{
		Files:       files,
		Fingerprint: hex.EncodeToString(h.Sum(nil)),
	}, nil
}
```

`WalkDir` visits every entry under `l.path`, including nested directories;
directories themselves are skipped (`d.IsDir()`) so only regular files
contribute an entry. Each file's path is made relative to the root via
`filepath.Rel` then normalized to forward slashes via `filepath.ToSlash` so
the `Path` is stable across platforms. After the walk, `files` is sorted by
path so both `Files` and the fingerprint are deterministic regardless of
filesystem iteration order. `h` is built in the same loop over the sorted
files, folding in each file's path, content length, and bytes — the same
scheme the flat version used, extended to the recursive file set — so the
fingerprint changes iff any file's path or content changes anywhere in the
tree.

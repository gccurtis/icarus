package connector

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

type localFolder struct{ path string }

// NewLocalFolderProvider reads a local directory (recursive over regular files,
// path-sorted) as the connector's content. For the proto this reads the
// directory in-process; the companion watcher program satisfies the same
// Provider contract over HTTP.
func NewLocalFolderProvider(path string) Provider { return localFolder{path: path} }

// Snapshot lists the folder and hashes each file, without retaining any file's
// content.
//
// It reads every file once — hashing is the only way to know whether a file
// changed, short of trusting mtime, which lies. What it no longer does is *keep*
// what it read: the whole folder used to be resident in the returned snapshot,
// and resident again in the writes applySync built from it. Here each file is
// streamed through a hash in a fixed buffer and released, and content is fetched
// later, per file, only for the files a sync decides it needs.
func (l localFolder) Snapshot() (Snapshot, error) {
	var files []FileEntry
	err := filepath.WalkDir(l.path, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		size, hash, err := hashFile(p)
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(l.path, p)
		if err != nil {
			return err
		}
		files = append(files, FileEntry{
			Path: filepath.ToSlash(rel),
			Size: size,
			Hash: hash,
			// Bound to the absolute path, not to the walk's state, so the opener
			// stays valid for as long as the caller holds the snapshot.
			Open: func() (io.ReadCloser, error) { return os.Open(p) },
		})
		return nil
	})
	if err != nil {
		return Snapshot{}, err
	}
	// Sorted before the fingerprint, because the fingerprint is order-sensitive
	// and a directory walk's order is not something to depend on.
	sortByPath(files)
	return Snapshot{Files: files, Fingerprint: FingerprintOf(files)}, nil
}

// OpenItem opens one root-relative file directly. It verifies the current hash
// before returning the descriptor, so an expected version is never satisfied by
// a renamed or replaced item. This reads only the requested file, never a
// connector-wide listing.
func (l localFolder) OpenItem(ctx context.Context, _ AuthorizedBinding, providerItemID, expectedVersion string) (io.ReadCloser, ItemMeta, error) {
	if err := ctx.Err(); err != nil {
		return nil, ItemMeta{}, err
	}
	clean := filepath.Clean(filepath.FromSlash(providerItemID))
	if clean == "." || filepath.IsAbs(clean) || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return nil, ItemMeta{}, ErrInvalidPath
	}
	root, err := filepath.EvalSymlinks(l.path)
	if err != nil {
		return nil, ItemMeta{}, err
	}
	path, err := filepath.EvalSymlinks(filepath.Join(root, clean))
	if os.IsNotExist(err) {
		return nil, ItemMeta{}, ErrNotFound
	}
	if err != nil {
		return nil, ItemMeta{}, err
	}
	rel, err := filepath.Rel(root, path)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return nil, ItemMeta{}, ErrInvalidPath
	}
	info, err := os.Stat(path)
	if os.IsNotExist(err) {
		return nil, ItemMeta{}, ErrNotFound
	}
	if err != nil {
		return nil, ItemMeta{}, err
	}
	if !info.Mode().IsRegular() {
		return nil, ItemMeta{}, ErrNotFound
	}
	_, hash, err := hashFile(path)
	if err != nil {
		return nil, ItemMeta{}, err
	}
	if expectedVersion != "" && expectedVersion != hash {
		return nil, ItemMeta{}, ErrVersionChanged
	}
	file, err := os.Open(path)
	if os.IsNotExist(err) {
		return nil, ItemMeta{}, ErrNotFound
	}
	if err != nil {
		return nil, ItemMeta{}, err
	}
	return file, ItemMeta{Version: hash, ContentHash: hash}, nil
}

// hashFile streams one file through SHA-256 and reports its size and hex digest.
// io.Copy uses a fixed internal buffer, so the cost is independent of the file's
// size — which is the point, since this runs over every file on every detector
// tick.
func hashFile(path string) (int64, string, error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, "", err
	}
	defer f.Close()
	h := sha256.New()
	n, err := io.Copy(h, f)
	if err != nil {
		return 0, "", err
	}
	return n, hex.EncodeToString(h.Sum(nil)), nil
}

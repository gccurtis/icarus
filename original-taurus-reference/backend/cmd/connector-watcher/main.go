// Command connector-watcher is a tiny standalone web server that stands in for an
// external content provider (a local folder today; Google Drive and friends
// later). It serves a listing of a folder and, on request, one file at a time, so
// the Omega connector can poll it — "has anything changed, and give me that one
// file" — exactly the shape a real provider offers. Change detection and
// filesystem access live here, out of the Omega server process.
//
// Usage:
//
//	connector-watcher -folder /path/to/watch [-addr 127.0.0.1:0]
//
// It prints the resolved listen address on startup (as "listening <addr>"), so a
// caller that passes :0 can discover the assigned port.
//
// # The wire protocol
//
//	GET /snapshot          NDJSON: one {"path","size","hash"} object per line
//	GET /file?path=<rel>   the raw bytes of one file
//
// The listing carries no content, and it is NDJSON rather than one document, so
// neither side ever holds the folder. It used to be a single JSON object with
// every file's content inline: the watcher buffered the whole corpus to encode
// it and Omega buffered it again to decode, on every detector tick, whether or
// not anything had changed. The hash is what makes most ticks free — Omega
// compares it per file and asks for nothing.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gccurtis/taurus-omega/core/capability/connector"
)

// snapshotLine is one line of the listing: a path relative to the watched folder
// (slash-separated), its size, and the hex SHA-256 of its content.
type snapshotLine struct {
	Path string `json:"path"`
	Size int64  `json:"size"`
	Hash string `json:"hash"`
}

// snapshotHandler serves the folder's current listing as NDJSON, reusing the same
// local-folder provider the in-process path uses so the two cannot describe a
// folder differently.
//
// Lines are flushed as they are produced. A 100k-file folder therefore starts
// arriving immediately and costs neither side a buffer proportional to it.
func snapshotHandler(folder string) http.HandlerFunc {
	provider := connector.NewLocalFolderProvider(folder)
	return func(w http.ResponseWriter, _ *http.Request) {
		snap, err := provider.Snapshot()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/x-ndjson")
		enc := json.NewEncoder(w)
		flusher, _ := w.(http.Flusher)
		for _, f := range snap.Files {
			if err := enc.Encode(snapshotLine{Path: f.Path, Size: f.Size, Hash: f.Hash}); err != nil {
				return
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
	}
}

// fileHandler streams one file out of the watched folder.
//
// The path is confined to the folder before anything is opened. A watcher is
// pointed at one directory and serves that directory; without this, "../" in a
// query parameter reads anything the process can — and the process is pointed at
// a user's own machine.
func fileHandler(folder string) http.HandlerFunc {
	root, err := filepath.Abs(folder)
	if err != nil {
		root = folder
	}
	// Resolved once, so a root that is itself reached through a symlink still
	// compares against the same real path the members will resolve to.
	if resolved, err := filepath.EvalSymlinks(root); err == nil {
		root = resolved
	}
	return func(w http.ResponseWriter, r *http.Request) {
		rel := r.URL.Query().Get("path")
		if rel == "" {
			http.Error(w, "path is required", http.StatusBadRequest)
			return
		}
		full, err := confine(root, rel)
		if err != nil {
			http.Error(w, "path is outside the watched folder", http.StatusBadRequest)
			return
		}
		f, err := os.Open(full)
		if err != nil {
			// A file present at listing time and gone at read time is ordinary for an
			// external source, so it is a 404 rather than a 500.
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		defer f.Close()
		info, err := f.Stat()
		if err != nil || info.IsDir() {
			http.Error(w, "not a readable file", http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/octet-stream")
		// Content-Length is what makes a truncated read detectable.
		//
		// Once a 200 is written it cannot be retracted, so a copy that fails halfway
		// would otherwise deliver a short body under a success status — and a
		// half-read file windows and embeds perfectly well, so it would be indexed
		// and cited as if complete. Declaring the length makes the client's read
		// fail with an unexpected EOF instead, which the lattice reports as an
		// unreadable source rather than silently accepting.
		w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
		if _, err := io.Copy(w, f); err != nil {
			// Nothing can be said to the client at this point; the length mismatch is
			// what tells it. This exists so the operator's log is not silent too.
			log.Printf("connector-watcher: serving %s: %v", rel, err)
		}
	}
}

// confine resolves rel inside root and refuses anything that escapes it.
//
// The lexical check alone is not enough, which is the part worth spelling out: a
// DIRECTORY SYMLINK inside the watched folder passes any amount of string
// comparison — the path never mentions "..", it just points somewhere else — and
// would serve that target's whole subtree. Resolving symlinks first and comparing
// the real paths is what closes it.
//
// The resolve is attempted on the parent when the target itself does not exist, so
// a request for a missing file still gets a 404 from the open below rather than
// being mistaken for an escape.
func confine(root, rel string) (string, error) {
	full, err := filepath.Abs(filepath.Join(root, filepath.FromSlash(rel)))
	if err != nil {
		return "", err
	}
	real, err := filepath.EvalSymlinks(full)
	if err != nil {
		// The target may simply not exist. Confine its parent instead, so the caller
		// reaches a 404 rather than an escape refusal.
		parent, perr := filepath.EvalSymlinks(filepath.Dir(full))
		if perr != nil {
			return "", err
		}
		real = filepath.Join(parent, filepath.Base(full))
	}
	if real != root && !strings.HasPrefix(real, root+string(os.PathSeparator)) {
		return "", fmt.Errorf("path %q escapes %q", rel, root)
	}
	return real, nil
}

func main() {
	addr := flag.String("addr", "127.0.0.1:0", "listen address (:0 assigns a free port)")
	folder := flag.String("folder", "", "the local folder to watch and serve")
	flag.Parse()
	if *folder == "" {
		fmt.Fprintln(os.Stderr, "connector-watcher: -folder is required")
		os.Exit(2)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/snapshot", snapshotHandler(*folder))
	mux.HandleFunc("/file", fileHandler(*folder))

	ln, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatalf("connector-watcher: listen: %v", err)
	}
	log.Printf("listening %s (watching %s)", ln.Addr().String(), *folder)
	if err := http.Serve(ln, mux); err != nil {
		log.Fatalf("connector-watcher: serve: %v", err)
	}
}

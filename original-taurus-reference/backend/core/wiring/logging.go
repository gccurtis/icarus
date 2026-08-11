package wiring

import (
	"io"
	"os"
	"path/filepath"
	"strings"
)

// logFileName is the file server logs are written to inside the configured
// logging directory.
const logFileName = "taurus-omega.log"

// logOutput resolves where the process's logs go from the configured directory.
// An empty dir logs to standard error (Go's default), for a dev or unconfigured
// run. Production is expected to set a dir: a file can be shipped for support and
// then deleted, rather than leaving logs streaming out of a long-lived process. A
// non-empty dir is created if missing, and logs are appended to logFileName
// inside it; the returned closer is the open file (nil for stderr) and must be
// closed on shutdown.
func logOutput(dir string) (io.Writer, io.Closer, error) {
	if strings.TrimSpace(dir) == "" {
		return os.Stderr, nil, nil
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, nil, err
	}
	f, err := os.OpenFile(filepath.Join(dir, logFileName), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, nil, err
	}
	return f, f, nil
}

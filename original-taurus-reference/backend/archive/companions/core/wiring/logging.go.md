# logging.go

Resolves where the process's logs go, from `logging.dir` in the config. Empty
(the default) logs to standard error, for a dev or unconfigured run; production
is expected to set a directory, where logs are appended to a file that can be
shipped for support and then deleted (rather than streaming out of a long-lived
process). A mounted config can redirect them without a code change. Wired at the
top of `Run` (`log.SetOutput`), before anything else runs, so all post-config
logs are captured. See repo conventions (AGENTS.md).

## Code breakdown

```go
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
```

The file is opened `O_APPEND` so a restart keeps the prior log rather than
truncating it. Returning the closer separately (nil for stdout) lets `Run` defer
its close only when a file was actually opened — stdout must never be closed.

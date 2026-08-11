# httpprovider.go

The `Provider` Omega uses to reach an external watcher/provider over HTTP: it GETs
`{endpoint}/snapshot` for the source's per-file content + fingerprint. Change
detection and source access live in the external service (the watcher, or a
real cloud provider later), so the Omega process holds no filesystem or
provider transport logic — it just polls this contract. See repo conventions
(AGENTS.md).

## Code breakdown

```go
package connector

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// httpProvider talks to an external watcher/provider over HTTP: it GETs
// {endpoint}/snapshot for the source's current content + fingerprint. This is the
// provider Omega uses for subkinds whose source is served by a watcher
// (local-folder today) — change detection and source access live in the external
// service, not in the Omega process.
type httpProvider struct {
	endpoint string
	client   *http.Client
}

// NewHTTPProvider returns a Provider that polls the watcher at endpoint.
func NewHTTPProvider(endpoint string) Provider {
	return httpProvider{endpoint: strings.TrimRight(endpoint, "/"), client: &http.Client{Timeout: 10 * time.Second}}
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
	var body struct {
		Files []struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		} `json:"files"`
		Fingerprint string `json:"fingerprint"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return Snapshot{}, err
	}
	files := make([]FileEntry, 0, len(body.Files))
	for _, f := range body.Files {
		files = append(files, FileEntry{Path: f.Path, Content: f.Content})
	}
	return Snapshot{Files: files, Fingerprint: body.Fingerprint}, nil
}
```

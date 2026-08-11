# workspace.go

Per-user workspace capability: a user's opaque per-project cockpit state (open tabs, panel geometry). The state is stored and returned verbatim; Omega validates only that it is a bounded (<=64 KiB) valid JSON object. Keyed per user x per project; last write wins. See repo conventions (AGENTS.md).

## Code breakdown

```go
// Package workspace stores a user's opaque per-project cockpit state — the open
// tabs and panel geometry that should follow them across devices. Omega treats
// the state as an opaque JSON blob: it validates only that the payload is a
// bounded, valid JSON object and returns it verbatim, so the cockpit can evolve
// the interior shape without a backend change. State is keyed per user × per
// project; last write wins.
package workspace

import (
	"encoding/json"
	"errors"
	"time"
)

// MaxStateBytes bounds one stored workspace state.
const MaxStateBytes = 64 * 1024

var (
	// ErrNotFound means the user has saved no workspace for the project yet.
	ErrNotFound = errors.New("workspace not found")
	// ErrTooLarge means the state exceeds MaxStateBytes.
	ErrTooLarge = errors.New("workspace state exceeds the maximum size")
	// ErrInvalid means the state is not a valid JSON object.
	ErrInvalid = errors.New("workspace state must be a JSON object")
)

// Workspace is one user's stored state for one project. State is opaque JSON the
// store never interprets.
type Workspace struct {
	UserID    string
	ProjectID string
	State     json.RawMessage
	UpdatedAt time.Time
}

// Store persists workspaces keyed by (user, project). The state is opaque bytes.
type Store interface {
	Workspace(userID, projectID string) (Workspace, error)
	SetWorkspace(w Workspace) error
}

// Workspaces is the workspace service. Every method is keyed by a user and a
// project, so a user only ever reaches their own per-project state.
type Workspaces struct{ store Store }

// New constructs the service over a store.
func New(store Store) *Workspaces { return &Workspaces{store: store} }

// Get returns a user's stored workspace for a project, or ErrNotFound when none
// has been saved.
func (w *Workspaces) Get(userID, projectID string) (Workspace, error) {
	return w.store.Workspace(userID, projectID)
}

// Set replaces a user's whole workspace state for a project (last write wins).
// The state must be a bounded, valid JSON object; it is stored verbatim.
func (w *Workspaces) Set(userID, projectID string, state json.RawMessage, now time.Time) (Workspace, error) {
	if len(state) > MaxStateBytes {
		return Workspace{}, ErrTooLarge
	}
	if !validJSONObject(state) {
		return Workspace{}, ErrInvalid
	}
	ws := Workspace{
		UserID:    userID,
		ProjectID: projectID,
		State:     append(json.RawMessage(nil), state...),
		UpdatedAt: now,
	}
	if err := w.store.SetWorkspace(ws); err != nil {
		return Workspace{}, err
	}
	return ws, nil
}

// validJSONObject reports whether b is a valid JSON object (its first
// non-whitespace byte is '{').
func validJSONObject(b []byte) bool {
	if !json.Valid(b) {
		return false
	}
	for _, c := range b {
		switch c {
		case ' ', '\t', '\n', '\r':
			continue
		case '{':
			return true
		default:
			return false
		}
	}
	return false
}
```

### The size bound reports its arithmetic

`Set` refuses a state over `MaxStateBytes` (64KB) through `tooLarge`, which returns a
`limit.Exceeded` carrying `CodeStateTooLarge`, the cap and the actual size — instead
of the bare `ErrTooLarge` sentinel whose message was the entire story.

The numbers are what make the failure actionable. A cockpit told its state is 70KB
against a 64KB cap can shed panels and retry; one told only "too large" can only
retry the same payload forever.

`stateLimit` keeps both identities, and both of its methods are load-bearing:

- `Is` preserves `errors.Is(err, ErrTooLarge)`, so callers asking only whether the
  bound was crossed are unaffected.
- `Unwrap` is what lets `errors.As` — and so `limit.From` — reach the embedded limit.
  Embedding alone is not enough: it promotes `Error()` and `Body()`, so the value
  prints like a limit while `errors.As` fails, because the concrete type is
  `*stateLimit` with no chain to walk. Getting this wrong once in `file.sizeLimit` is
  why the test here asserts the sentinel and the numbers together.

The sentinel itself stays: it is what `TestRejectsOversized` and the handler have
always asked for, and enriching an error must not silently break the checks that
already matched it.

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

	"github.com/gccurtis/taurus-omega/core/platform/limit"
)

// MaxStateBytes bounds one stored workspace state.
const MaxStateBytes = 64 * 1024

// CodeStateTooLarge is the stable identity of the state size bound.
const CodeStateTooLarge = "workspace_state_too_large"

var (
	// ErrNotFound means the user has saved no workspace for the project yet.
	ErrNotFound = errors.New("workspace not found")
	// ErrTooLarge means the state exceeds MaxStateBytes.
	ErrTooLarge = errors.New("workspace state exceeds the maximum size")
	// ErrInvalid means the state is not a valid JSON object.
	ErrInvalid = errors.New("workspace state must be a JSON object")
)

// stateLimit is a limit.Exceeded that also answers to the ErrTooLarge sentinel, so
// the bound reports its arithmetic without breaking the callers that only ask
// whether it was crossed. Same shape as file.sizeLimit — including the Unwrap, which
// embedding does not provide and without which errors.As cannot find the limit.
type stateLimit struct{ *limit.Exceeded }

func (e *stateLimit) Is(target error) bool { return target == ErrTooLarge }

func (e *stateLimit) Unwrap() error { return e.Exceeded }

// tooLarge builds the size bound with its numbers attached. A cockpit that knows the
// state is 70KB against a 64KB cap can shed panels; one told only "too large"
// cannot.
func tooLarge(size int) error {
	return &stateLimit{&limit.Exceeded{
		Code:    CodeStateTooLarge,
		Message: "workspace state exceeds the maximum size",
		Limit:   MaxStateBytes,
		Actual:  int64(size),
	}}
}

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
		return Workspace{}, tooLarge(len(state))
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

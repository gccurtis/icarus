// Package workspace exposes a user's opaque per-project cockpit state over HTTP:
// GET returns the saved state (spread at top level with an updatedAt field), and
// PUT replaces it wholesale. The state is stored and returned verbatim; Omega
// validates only its size and that it is a JSON object.
package workspace

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	workspacecap "github.com/gccurtis/taurus-omega/core/capability/workspace"
	"github.com/gccurtis/taurus-omega/core/endpoint"
	"github.com/gccurtis/taurus-omega/core/platform/limit"
)

// Handlers serve the /workspace routes over a workspace service.
type Handlers struct {
	workspaces *workspacecap.Workspaces
	now        func() time.Time
}

// NewHandlers constructs the workspace handlers.
func NewHandlers(workspaces *workspacecap.Workspaces) Handlers {
	return Handlers{workspaces: workspaces, now: time.Now}
}

// Get returns the caller's workspace for the selected project — the stored state
// spread at top level with an added updatedAt — or {"updatedAt": null} when the
// user has saved nothing.
func (h Handlers) Get(ctx access.Context, _ endpoint.Request) endpoint.Response {
	if ctx.Project == nil {
		return errResp(http.StatusBadRequest, "no project selected")
	}
	ws, err := h.workspaces.Get(ctx.User.ID, ctx.Project.ID)
	if errors.Is(err, workspacecap.ErrNotFound) {
		return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"updatedAt": nil}}
	}
	if err != nil {
		return endpoint.Fail(http.StatusInternalServerError, "could not load workspace", err)
	}
	obj := map[string]json.RawMessage{}
	if err := json.Unmarshal(ws.State, &obj); err != nil {
		obj = map[string]json.RawMessage{}
	}
	stamp, _ := json.Marshal(ws.UpdatedAt.UTC().Format(time.RFC3339Nano))
	obj["updatedAt"] = stamp
	return endpoint.Response{Status: http.StatusOK, Body: obj}
}

// Put replaces the caller's whole workspace state for the selected project. Any
// member may save their own workspace — it is personal UI state, not project
// content. Returns {updatedAt} on success.
func (h Handlers) Put(ctx access.Context, req endpoint.Request) endpoint.Response {
	if ctx.Project == nil {
		return errResp(http.StatusBadRequest, "no project selected")
	}
	var state json.RawMessage
	if err := req.Bind(&state); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	ws, err := h.workspaces.Set(ctx.User.ID, ctx.Project.ID, state, h.now())
	// The limit arm precedes the sentinel arms: the size failure still satisfies
	// errors.Is(err, ErrTooLarge), so a sentinel arm above would claim it and discard
	// the numbers a cockpit needs in order to shed state and retry.
	if e, ok := limit.From(err); ok {
		return endpoint.Response{Status: http.StatusRequestEntityTooLarge, Body: e.Body(), Err: err}
	}
	switch {
	case errors.Is(err, workspacecap.ErrInvalid):
		return errResp(http.StatusBadRequest, "workspace state must be a JSON object")
	case err != nil:
		return endpoint.Fail(http.StatusInternalServerError, "could not save workspace", err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{
		"updatedAt": ws.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}}
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]any{"error": msg}}
}

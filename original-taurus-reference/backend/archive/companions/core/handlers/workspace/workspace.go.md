# workspace.go

Workspace HTTP handlers: GET returns the caller's saved per-project state spread with an updatedAt field (or {updatedAt:null} when unset); PUT replaces it wholesale. State is opaque JSON, stored and returned verbatim. See repo conventions (AGENTS.md).

## Code breakdown

```go
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
		return errResp(http.StatusInternalServerError, "could not load workspace")
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
	switch {
	case errors.Is(err, workspacecap.ErrTooLarge):
		return errResp(http.StatusRequestEntityTooLarge, "workspace state is too large")
	case errors.Is(err, workspacecap.ErrInvalid):
		return errResp(http.StatusBadRequest, "workspace state must be a JSON object")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not save workspace")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{
		"updatedAt": ws.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}}
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]any{"error": msg}}
}
```

### Failures carry their cause

Its 2 failure responses (`could not load workspace`, and the rest)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.

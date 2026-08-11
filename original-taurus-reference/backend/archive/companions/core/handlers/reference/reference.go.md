# reference.go

HTTP handlers for the reference-graph endpoints: a document's outgoing references and its backlinks, both project-scoped reads. See repo conventions (AGENTS.md).

## Code breakdown

```go
// Package reference exposes the project-scoped reference-graph endpoints: a
// document's outgoing references and its backlinks. Each route is project-scoped
// by transport before it reaches these handlers, and both are reads available to
// any project member.
package reference

import (
	"errors"
	"net/http"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	refcap "github.com/gccurtis/taurus-omega/core/capability/reference"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// Handlers adapt the reference service to HTTP.
type Handlers struct {
	refs *refcap.References
}

// NewHandlers binds the reference endpoints to the reference service.
func NewHandlers(refs *refcap.References) Handlers { return Handlers{refs: refs} }

// References returns a document's outgoing reference edges.
func (h Handlers) References(ctx access.Context, req endpoint.Request) endpoint.Response {
	edges, err := h.refs.References(refcap.Scope{ProjectID: ctx.Project.ID}, refcap.KindDocument, req.Param("documentID"))
	if err != nil {
		return refErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"references": nonNil(edges)}}
}

// Backlinks returns the edges that point at a document.
func (h Handlers) Backlinks(ctx access.Context, req endpoint.Request) endpoint.Response {
	edges, err := h.refs.Backlinks(refcap.Scope{ProjectID: ctx.Project.ID}, refcap.KindDocument, req.Param("documentID"))
	if err != nil {
		return refErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"backlinks": nonNil(edges)}}
}

func nonNil(edges []refcap.Edge) []refcap.Edge {
	if edges == nil {
		return []refcap.Edge{}
	}
	return edges
}

func refErr(err error) endpoint.Response {
	switch {
	case errors.Is(err, refcap.ErrInvalidScope):
		return endpoint.Response{Status: http.StatusBadRequest, Body: map[string]string{"error": err.Error()}}
	default:
		return endpoint.Response{Status: http.StatusInternalServerError, Body: map[string]string{"error": "reference lookup failed"}}
	}
}
```

### Failures carry their cause

Its one failure response (`reference lookup failed`)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.

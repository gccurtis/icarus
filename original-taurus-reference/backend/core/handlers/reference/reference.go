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
		return endpoint.Fail(http.StatusInternalServerError, "reference lookup failed", err)
	}
}

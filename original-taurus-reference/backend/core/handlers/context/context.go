// Package context serves the project-scoped context resource routes: create,
// list, get, resolve, update, and delete. A context is a named set of resource
// references; the resolve route flattens it to leaf origins.
package context

import (
	"errors"
	"net/http"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	contextscap "github.com/gccurtis/taurus-omega/core/capability/contexts"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

type Handlers struct{ contexts *contextscap.Contexts }

func NewHandlers(c *contextscap.Contexts) Handlers { return Handlers{contexts: c} }

type refJSON struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
	Name string `json:"name,omitempty"`
}

type contextJSON struct {
	ID        string    `json:"id"`
	Kind      string    `json:"kind"`
	Name      string    `json:"name"`
	Includes  []refJSON `json:"includes"`
	Excludes  []refJSON `json:"excludes"`
	CreatedAt string    `json:"createdAt"`
	UpdatedAt string    `json:"updatedAt"`
}

func refsOut(refs []contextscap.Ref) []refJSON {
	out := make([]refJSON, 0, len(refs))
	for _, r := range refs {
		out = append(out, refJSON{Kind: r.Kind, ID: r.ID, Name: r.Name})
	}
	return out
}

func refsIn(refs []refJSON) []contextscap.Ref {
	out := make([]contextscap.Ref, 0, len(refs))
	for _, r := range refs {
		out = append(out, contextscap.Ref{Kind: r.Kind, ID: r.ID, Name: r.Name})
	}
	return out
}

func view(c contextscap.Context) contextJSON {
	return contextJSON{
		ID: c.ID, Kind: contextscap.KindContext, Name: c.Name,
		Includes:  refsOut(c.Includes),
		Excludes:  refsOut(c.Excludes),
		CreatedAt: c.CreatedAt.UTC().Format(time.RFC3339Nano),
		UpdatedAt: c.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}
}

func (h Handlers) Create(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Name     string    `json:"name"`
		Includes []refJSON `json:"includes"`
		Excludes []refJSON `json:"excludes"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	c, err := h.contexts.Create(ctx.Project.ID, contextscap.Actor{ID: ctx.User.ID, Name: ctx.User.Name},
		in.Name, refsIn(in.Includes), refsIn(in.Excludes))
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusCreated, Body: view(c)}
}

func (h Handlers) List(ctx access.Context, req endpoint.Request) endpoint.Response {
	list, err := h.contexts.List(ctx.Project.ID)
	if err != nil {
		return mapErr(err)
	}
	out := make([]contextJSON, 0, len(list))
	for _, c := range list {
		out = append(out, view(c))
	}
	return endpoint.Response{Status: http.StatusOK, Body: out}
}

func (h Handlers) Get(ctx access.Context, req endpoint.Request) endpoint.Response {
	c, err := h.contexts.Get(ctx.Project.ID, req.Param("contextID"))
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: view(c)}
}

func (h Handlers) Resolved(ctx access.Context, req endpoint.Request) endpoint.Response {
	id := req.Param("contextID")
	if _, err := h.contexts.Get(ctx.Project.ID, id); err != nil {
		return mapErr(err)
	}
	leaves, err := h.contexts.ResolveID(ctx.Project.ID, id)
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"origins": refsOut(leaves)}}
}

func (h Handlers) Update(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Name     string    `json:"name"`
		Includes []refJSON `json:"includes"`
		Excludes []refJSON `json:"excludes"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	c, err := h.contexts.Update(ctx.Project.ID, req.Param("contextID"), in.Name, refsIn(in.Includes), refsIn(in.Excludes))
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: view(c)}
}

func (h Handlers) Delete(ctx access.Context, req endpoint.Request) endpoint.Response {
	if err := h.contexts.Delete(ctx.Project.ID, req.Param("contextID")); err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"deleted": true}}
}

func mapErr(err error) endpoint.Response {
	switch {
	case errors.Is(err, contextscap.ErrNotFound):
		return errResp(http.StatusNotFound, "context not found")
	case errors.Is(err, contextscap.ErrInvalidName):
		return errResp(http.StatusBadRequest, "context name must not be empty")
	case errors.Is(err, contextscap.ErrUnknownMember):
		return errResp(http.StatusBadRequest, "context member does not exist")
	case errors.Is(err, contextscap.ErrCycle):
		return errResp(http.StatusBadRequest, "context membership would create a cycle")
	default:
		return endpoint.Fail(http.StatusInternalServerError, "context error", err)
	}
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]any{"error": msg}}
}

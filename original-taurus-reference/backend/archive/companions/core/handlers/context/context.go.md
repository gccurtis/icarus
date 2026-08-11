# context.go

The context HTTP handlers: create, list, get, resolve, update, and delete a
project-scoped context resource. Create and Update accept `{name, includes,
excludes}` and replace membership wholesale (no partial patch of individual
refs) — and reject the request outright if any member ref names something
that doesn't exist, per `contexts.Contexts.validateMembersExist`, or if the
new membership would close a cycle in the context→context reference graph,
per `contexts.Contexts.wouldCycle`; Resolved existence-checks the requested
context via `Get` first (so a missing/foreign top-level id 404s, matching
`Get`/`Update`/`Delete`), then flattens the stored definition to its leaf
origins via `ResolveID` — that existence check is only about the endpoint's
own subject; a dangling *member* reference inside a real context's definition
still resolves to nothing, per `resolve.go`, unchanged (write-time validation
means a *new* dangling member ref, or one that would create a cycle, can no
longer be stored, but data already on disk before these checks existed still
resolves permissively). Each handler delegates to `*contexts.Contexts`,
projects the record into a JSON view, and maps capability errors to HTTP
statuses (404 not found, 400 bad name, unknown member, or cycle). Registered
on the project-scoped group when `Options.Contexts` is set. See repo
conventions (AGENTS.md).

## Code breakdown

```go
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
		return errResp(http.StatusInternalServerError, "context error")
	}
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]any{"error": msg}}
}
```

### Failures carry their cause

Its one failure response (`context error`)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.

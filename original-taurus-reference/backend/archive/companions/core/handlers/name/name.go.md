# name.go

`name.go` is the HTTP-facing half of the formula name manager: it turns
`names.Manager` — a project-scoped namespace of stored scalars, tables, and
functions, plus expression evaluation over it — into `endpoint`-shaped handlers
the transport layer can route. It mirrors the shape of `handlers/project` and
`handlers/document`: a thin `Handlers` struct over the capability it drives, one
method per endpoint, and a small set of shared helpers for authorization and
error mapping.

The one departure from `handlers/document`'s pattern is authorization. A
document handler scopes to `ctx.Project.ID` and checks `ctx.Role`, both already
resolved from the session's *selected* project. A name-manager route is scoped
by the `:projectID` path parameter instead, and authorizes against exactly that
project — a caller can read or write a project's names without it being their
current selection — so every handler here calls `access.Access.MembershipRole`
directly rather than trusting `ctx.Role`.

## Code breakdown

### Package documentation and imports

```go
// Package name implements the formula name-manager endpoints: listing,
// reading, and deleting the names stored in a project's namespace, setting a
// scalar, a table, or a function under a name, growing a table by column or by
// row, and evaluating a Formula expression against the namespace. Every
// endpoint is scoped to the :projectID path parameter and authorizes the
// caller against that project directly (rather than the session's selected
// project), since a caller may act on a project's names without it being their
// current selection.
package name

import (
	"errors"
	"net/http"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/capability/formula"
	"github.com/gccurtis/taurus-omega/core/capability/formula/names"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

```

The package comment states the departure from the rest of `core/handlers` up
front: every route is scoped by the `:projectID` path parameter and authorized
against that project directly, not the session's selection. `errors` backs the
`errors.Is`/`errors.As` error-mapping helpers; `net/http` supplies status codes;
`time` formats `CreatedAt`/`UpdatedAt` as RFC3339 for the wire. `access` supplies
`Access`, `Context`, `Role`, and `ErrForbidden`; `formula` supplies `Value` and
`FormulaError`, both used directly as request/response payloads and in error
mapping; `names` supplies the `Manager`, `Entry`, `Column`, and the package's
sentinel errors; `endpoint` is the transport-agnostic `Request`/`Response`
contract every method here is written against.

### Handlers and its constructor

```go
// Handlers holds the name-manager endpoints, bound to the Access service (for
// authorization) and the name Manager they drive.
type Handlers struct {
	access *access.Access
	names  *names.Manager
}

// NewHandlers builds the name-manager endpoints.
func NewHandlers(a *access.Access, m *names.Manager) Handlers {
	return Handlers{access: a, names: m}
}

```

`Handlers` pairs the two dependencies every method needs: `access`, used only
for `MembershipRole` authorization checks, and `names`, the manager the
endpoints actually drive. `NewHandlers` is the one constructor, matching
`project.NewHandlers` and `document.NewHandlers`'s shape.

### authorizeRead and authorizeWrite

```go
// authorizeRead permits any member (owner, edit, or read) of the project.
func (h Handlers) authorizeRead(userID, projectID string) (endpoint.Response, bool) {
	if _, err := h.access.MembershipRole(userID, projectID); err != nil {
		return mapAccessErr(err), false
	}
	return endpoint.Response{}, true
}

// authorizeWrite permits only an owner or edit member; a read member is
// refused, and a non-member gets the same ErrForbidden a read check would.
func (h Handlers) authorizeWrite(userID, projectID string) (endpoint.Response, bool) {
	role, err := h.access.MembershipRole(userID, projectID)
	if err != nil {
		return mapAccessErr(err), false
	}
	if role != access.RoleOwner && role != access.RoleEdit {
		return errResp(http.StatusForbidden, "read access cannot modify names"), false
	}
	return endpoint.Response{}, true
}

```

These are the two authorization gates every method below opens with, both
built on `access.Access.MembershipRole` rather than the resolved `ctx.Role`.
`authorizeRead` only confirms membership exists — any role may read.
`authorizeWrite` additionally rejects a `RoleRead` member with a 403, so only
an owner or editor can mutate the namespace. Both return `(endpoint.Response,
bool)`: on failure the response is the one to return immediately, and the
caller pattern is a one-line `if resp, ok := h.authorizeX(...); !ok { return
resp }` at the top of every handler — the same shape `access.Role.CanWrite`
establishes, generalized to carry its own failure response instead of a bare
bool, since a non-member and a read-only member need different status codes.

### entryView and view

```go
// entryView is the wire shape of one stored name: the fields every entry
// carries, plus whichever of value, columns/rows, or source its type
// populates.
type entryView struct {
	Name      string            `json:"name"`
	Type      string            `json:"type"`
	Value     *formula.Value    `json:"value,omitempty"`
	Columns   []names.Column    `json:"columns,omitempty"`
	Rows      [][]formula.Value `json:"rows,omitempty"`
	Source    *string           `json:"source,omitempty"`
	CreatedAt string            `json:"createdAt"`
	UpdatedAt string            `json:"updatedAt"`
}

func view(e names.Entry) entryView {
	out := entryView{
		Name:      e.Name,
		Type:      string(e.Type),
		CreatedAt: e.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt: e.UpdatedAt.UTC().Format(time.RFC3339),
	}
	switch e.Type {
	case names.TypeNull, names.TypeNumber, names.TypeText, names.TypeLogic:
		out.Value = &e.Value
	case names.TypeTable:
		out.Columns = e.Schema
		out.Rows = e.Rows
	case names.TypeFunction:
		out.Source = &e.Source
	}
	return out
}

```

`entryView` is the read-side wire shape for one `names.Entry` — the same
tagged-union idea `Entry` itself uses, carried onto JSON: `Value`, `Columns`/
`Rows`, and `Source` are all pointer or nil-able fields tagged `omitempty`, so
only the one the entry's `Type` actually populates appears in the response.
`Value` embeds a `*formula.Value`, which rides on `formula.Value`'s own strict
`MarshalJSON` — the handler never re-implements value encoding. `view` is the
one converter every read and mutation-echoing method funnels an `Entry`
through: it always sets the common fields (`Name`, `Type`, and the two
RFC3339-formatted timestamps), then a `switch` on `Type` fills in exactly the
one type-specific field that entry carries, leaving the other two nil so they
are omitted.

### List

```go
// List returns every name in the project's namespace. Any member may read it.
func (h Handlers) List(ctx access.Context, req endpoint.Request) endpoint.Response {
	projectID := req.Param("projectID")
	if resp, ok := h.authorizeRead(ctx.User.ID, projectID); !ok {
		return resp
	}
	entries, err := h.names.List(projectID)
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not list names")
	}
	out := make([]entryView, 0, len(entries))
	for _, e := range entries {
		out = append(out, view(e))
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"names": out}}
}

```

`List` is `GET /projects/:projectID/names`: authorize read, list every entry
in the project's namespace, and render each through `view`. The slice is
built with `make(..., 0, len(entries))` so an empty namespace serializes as
`"names": []` rather than `null`.

### Get

```go
// Get returns one name from the project's namespace. Any member may read it.
func (h Handlers) Get(ctx access.Context, req endpoint.Request) endpoint.Response {
	projectID := req.Param("projectID")
	if resp, ok := h.authorizeRead(ctx.User.ID, projectID); !ok {
		return resp
	}
	e, err := h.names.Get(projectID, req.Param("name"))
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: view(e)}
}

```

`Get` is `GET /projects/:projectID/names/:name`: authorize read, fetch the one
named entry, and render it. A missing name reaches the caller as a 404 via
`mapErr`.

### Delete

```go
// Delete removes one name from the project's namespace. Requires write access.
func (h Handlers) Delete(ctx access.Context, req endpoint.Request) endpoint.Response {
	projectID := req.Param("projectID")
	if resp, ok := h.authorizeWrite(ctx.User.ID, projectID); !ok {
		return resp
	}
	if err := h.names.Delete(projectID, req.Param("name")); err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "deleted"}}
}

```

`Delete` is `DELETE /projects/:projectID/names/:name`: authorize write, delete
the named entry, and report the outcome in the `document`/`project` handlers'
`{"status": "..."}` shape.

### SetValue

```go
// SetValue stores a scalar (number, text, logic, or null) under a name.
// Requires write access.
func (h Handlers) SetValue(ctx access.Context, req endpoint.Request) endpoint.Response {
	projectID := req.Param("projectID")
	if resp, ok := h.authorizeWrite(ctx.User.ID, projectID); !ok {
		return resp
	}
	var value formula.Value
	if err := req.Bind(&value); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	if err := h.names.SetScalar(projectID, req.Param("name"), value); err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "set"}}
}

```

`SetValue` is `PUT /projects/:projectID/names/:name/value`: authorize write,
bind the request body directly as a `formula.Value` — its own strict
`UnmarshalJSON` does the validation, rejecting anything that is not a well-formed
scalar wire value — and store it via `SetScalar`.

### SetTable

```go
// SetTable stores a table wholesale under a name. Requires write access.
func (h Handlers) SetTable(ctx access.Context, req endpoint.Request) endpoint.Response {
	projectID := req.Param("projectID")
	if resp, ok := h.authorizeWrite(ctx.User.ID, projectID); !ok {
		return resp
	}
	var in struct {
		Columns []names.Column    `json:"columns"`
		Rows    [][]formula.Value `json:"rows"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	if err := h.names.SetTable(projectID, req.Param("name"), in.Columns, in.Rows); err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "set"}}
}

```

`SetTable` is `PUT /projects/:projectID/names/:name/table`: authorize write,
bind the declared column schema and the full row set, and replace the table
wholesale via `SetTable`. Column and cell validation (types, ragged rows, no
functions in cells) all happens inside the Manager; the handler only maps
whatever sentinel comes back.

### SetFunction

```go
// SetFunction stores a function from its source under a name. Requires write
// access.
func (h Handlers) SetFunction(ctx access.Context, req endpoint.Request) endpoint.Response {
	projectID := req.Param("projectID")
	if resp, ok := h.authorizeWrite(ctx.User.ID, projectID); !ok {
		return resp
	}
	var in struct {
		Source string `json:"source"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	if err := h.names.SetFunction(projectID, req.Param("name"), in.Source); err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "set"}}
}

```

`SetFunction` is `PUT /projects/:projectID/names/:name/function`: authorize
write, bind the raw source text, and store it via `SetFunction`, which parses
it and rejects anything that is not a `FUNCTION`/`LAMBDA` definition. A parse
failure surfaces as a `*formula.FormulaError`, which `mapErr` renders as a
structured 400 rather than a bare message.

### CreateTable

```go
// CreateTable creates a new, empty table with the given columns, failing with
// 409 if the name is already taken (unlike SetTable, which replaces). Requires
// write access.
func (h Handlers) CreateTable(ctx access.Context, req endpoint.Request) endpoint.Response {
	projectID := req.Param("projectID")
	if resp, ok := h.authorizeWrite(ctx.User.ID, projectID); !ok {
		return resp
	}
	var in struct {
		Columns []names.Column `json:"columns"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	if err := h.names.CreateTable(projectID, req.Param("name"), in.Columns); err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusCreated, Body: map[string]string{"status": "created"}}
}

```

`CreateTable` is `POST /projects/:projectID/names/:name/table`: authorize
write, bind the declared columns, and build a fresh empty table via
`Manager.CreateTable`, which fails with `names.ErrNameExists` — mapped to a 409
— if the name is already taken. This is the constructive counterpart to
`SetTable`'s `PUT` on the same `.../table` path: `SetTable` always succeeds by
replacing whatever was there, while `CreateTable` only ever creates, so a build
that walks `CreateTable` → `AddColumn` → `AppendRows` can never silently
clobber an existing name. On success it reports `201 Created`, unlike every
other setter here which reports `200` for an upsert.

### AddColumn

```go
// AddColumn appends a typed column to an existing table. Requires write access.
func (h Handlers) AddColumn(ctx access.Context, req endpoint.Request) endpoint.Response {
	projectID := req.Param("projectID")
	if resp, ok := h.authorizeWrite(ctx.User.ID, projectID); !ok {
		return resp
	}
	var column names.Column
	if err := req.Bind(&column); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	if err := h.names.AddColumn(projectID, req.Param("name"), column); err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "set"}}
}

```

`AddColumn` is `POST /projects/:projectID/names/:name/columns`: authorize
write, bind one `names.Column`, and grow the existing table by that column via
`AddColumn` — every existing row gets a null cell in the new column. A target
that is not a table surfaces as `names.ErrNotATable`, mapped to a 409.

### AppendRows

```go
// AppendRows appends rows to an existing table. Requires write access.
func (h Handlers) AppendRows(ctx access.Context, req endpoint.Request) endpoint.Response {
	projectID := req.Param("projectID")
	if resp, ok := h.authorizeWrite(ctx.User.ID, projectID); !ok {
		return resp
	}
	var in struct {
		Rows [][]formula.Value `json:"rows"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	if err := h.names.AppendRows(projectID, req.Param("name"), in.Rows); err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "set"}}
}

```

`AppendRows` is `POST /projects/:projectID/names/:name/rows`: authorize write,
bind the new rows, and append them via `AppendRows`, which type-checks each
against the table's current schema before committing any of them.

### Evaluate

```go
// Evaluate evaluates a Formula expression against the project's namespace. Any
// member may evaluate; evaluation only reads the namespace.
func (h Handlers) Evaluate(ctx access.Context, req endpoint.Request) endpoint.Response {
	projectID := req.Param("projectID")
	if resp, ok := h.authorizeRead(ctx.User.ID, projectID); !ok {
		return resp
	}
	var in struct {
		Source string `json:"source"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	value, err := h.names.Evaluate(projectID, in.Source)
	if err != nil {
		return mapErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"value": value}}
}

```

`Evaluate` is `POST /projects/:projectID/evaluate`: authorize *read*, not
write — evaluation never mutates the namespace, it only resolves identifiers
against a snapshot of it — bind the source expression, and run it through
`Manager.Evaluate`. The result is returned as `{"value": ...}`, letting
`formula.Value`'s own `MarshalJSON` render it. A parse or evaluation failure
comes back as a `*formula.FormulaError`, handled the same structured way as
`SetFunction`'s.

### mapAccessErr

```go
// mapAccessErr translates a MembershipRole failure: ErrForbidden (not a
// member, or a project that does not exist) becomes 403; anything else is an
// unexpected store failure.
func mapAccessErr(err error) endpoint.Response {
	if errors.Is(err, access.ErrForbidden) {
		return errResp(http.StatusForbidden, "not a member of that project")
	}
	return errResp(http.StatusInternalServerError, "could not check access")
}

```

`mapAccessErr` is the one place a `MembershipRole` failure becomes a response.
`MembershipRole` only ever returns `ErrForbidden` or an unexpected store
error, so the mapping is a single check: forbidden becomes 403, anything else
(a store outage, say) becomes 500 rather than leaking internals.

### mapErr

```go
// mapErr translates a names.Manager or formula evaluation failure into a
// response: a missing name is 404; a conflicting constructive write is 409;
// every validation sentinel is 400; a structured *formula.FormulaError (a
// parse or evaluation failure from Evaluate or SetFunction) is 400 with the
// error and its machine-readable kind in the body; anything else is 500.
func mapErr(err error) endpoint.Response {
	switch {
	case errors.Is(err, names.ErrNotFound):
		return errResp(http.StatusNotFound, "name not found")
	case errors.Is(err, names.ErrNameExists):
		return errResp(http.StatusConflict, "name already exists")
	case errors.Is(err, names.ErrNotATable):
		return errResp(http.StatusConflict, "name does not hold a table")
	case errors.Is(err, names.ErrReservedName),
		errors.Is(err, names.ErrInvalidName),
		errors.Is(err, names.ErrInvalidColumnType),
		errors.Is(err, names.ErrDuplicateColumn),
		errors.Is(err, names.ErrTypeMismatch),
		errors.Is(err, names.ErrRaggedRow),
		errors.Is(err, names.ErrFunctionInCell),
		errors.Is(err, names.ErrNotScalar),
		errors.Is(err, names.ErrNotAFunction):
		return errResp(http.StatusBadRequest, err.Error())
	}
	var fe *formula.FormulaError
	if errors.As(err, &fe) {
		return endpoint.Response{Status: http.StatusBadRequest, Body: map[string]any{"error": fe.Error(), "kind": string(fe.Kind)}}
	}
	return errResp(http.StatusInternalServerError, "internal error")
}

```

`mapErr` is the shared error boundary for every `names.Manager` call in this
file. It is a tagless `switch` (each `case` a boolean `errors.Is` check, so the
first true one wins): `ErrNotFound` is a 404; the two constructive-write
conflicts, `ErrNameExists` and `ErrNotATable`, are 409s; and the nine
remaining validation sentinels — reserved/invalid names, column and cell
validation failures, a function-in-a-cell, a non-scalar or non-function
source — all collapse to a 400 carrying the sentinel's own message, since each
is already a precise, safe-to-expose description of what was wrong with the
request. Only after none of those match does it check for a
`*formula.FormulaError` via `errors.As` — the structured failure `SetFunction`'s
parse and `Evaluate`'s parse-or-run can produce — rendering it as a 400 with
both the human message and the machine-readable `Kind`, so a client can branch
on the failure category without string-matching. Anything else is an
unexpected error, mapped to 500.

### errResp

```go
func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
}
```

The same one-line `{"error": msg}` helper every handler package in
`core/handlers` defines for itself.

### Failures carry their cause

Its 3 failure responses (`could not list names`, and the rest)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.

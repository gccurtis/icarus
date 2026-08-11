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

// List returns every name in the project's namespace. Any member may read it.
func (h Handlers) List(ctx access.Context, req endpoint.Request) endpoint.Response {
	projectID := req.Param("projectID")
	if resp, ok := h.authorizeRead(ctx.User.ID, projectID); !ok {
		return resp
	}
	entries, err := h.names.List(projectID)
	if err != nil {
		return endpoint.Fail(http.StatusInternalServerError, "could not list names", err)
	}
	out := make([]entryView, 0, len(entries))
	for _, e := range entries {
		out = append(out, view(e))
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"names": out}}
}

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

// mapAccessErr translates a MembershipRole failure: ErrForbidden (not a
// member, or a project that does not exist) becomes 403; anything else is an
// unexpected store failure.
func mapAccessErr(err error) endpoint.Response {
	if errors.Is(err, access.ErrForbidden) {
		return errResp(http.StatusForbidden, "not a member of that project")
	}
	return endpoint.Fail(http.StatusInternalServerError, "could not check access", err)
}

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
	return endpoint.Fail(http.StatusInternalServerError, "internal error", err)
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
}

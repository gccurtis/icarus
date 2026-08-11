// Package persona exposes the Project-local Persona lifecycle, defaults, and
// Persona-attributed Task history.
package persona

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/capability/agent"
	personacap "github.com/gccurtis/taurus-omega/core/capability/persona"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

type Handlers struct {
	personas *personacap.Personas
	tasks    *agent.Tasks
}

func NewHandlers(personas *personacap.Personas, tasks *agent.Tasks) Handlers {
	return Handlers{personas: personas, tasks: tasks}
}

func (h Handlers) Create(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot create personas")
	}
	var input personacap.CreateRequest
	if err := req.Bind(&input); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	record, err := h.personas.Create(scope(ctx), ctx.User.ID, input)
	if err != nil {
		return personaErr(err)
	}
	return endpoint.Response{Status: http.StatusCreated, Body: record}
}

func (h Handlers) Revise(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot revise personas")
	}
	var input struct {
		ExpectedVersion int                   `json:"expectedVersion"`
		Definition      personacap.Definition `json:"definition"`
	}
	if err := req.Bind(&input); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	record, err := h.personas.Revise(scope(ctx), ctx.User.ID, req.Param("personaID"), input.ExpectedVersion, input.Definition)
	if err != nil {
		return personaErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: record}
}

func (h Handlers) Update(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot edit personas")
	}
	var input personacap.UpdateRequest
	if err := req.Bind(&input); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	record, err := h.personas.Update(scope(ctx), ctx.User.ID, req.Param("personaID"), input)
	if err != nil {
		return personaErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: record}
}

func (h Handlers) Delete(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot delete personas")
	}
	if err := h.personas.Delete(scope(ctx), req.Param("personaID")); err != nil {
		return personaErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "deleted"}}
}

func (h Handlers) Get(ctx access.Context, req endpoint.Request) endpoint.Response {
	record, err := h.personas.Get(scope(ctx), personacap.Selection{ID: req.Param("personaID")})
	if err != nil {
		return personaErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: record}
}

func (h Handlers) GetVersion(ctx access.Context, req endpoint.Request) endpoint.Response {
	version, err := strconv.Atoi(req.Param("version"))
	if err != nil || version < 1 {
		return errResp(http.StatusBadRequest, "invalid persona version")
	}
	record, err := h.personas.Get(scope(ctx), personacap.Selection{ID: req.Param("personaID"), Version: version})
	if err != nil {
		return personaErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: record}
}

func (h Handlers) List(ctx access.Context, _ endpoint.Request) endpoint.Response {
	records, err := h.personas.List(scope(ctx))
	if err != nil {
		return personaErr(err)
	}
	if records == nil {
		records = []personacap.Record{}
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"personas": records}}
}

func (h Handlers) Versions(ctx access.Context, req endpoint.Request) endpoint.Response {
	versions, err := h.personas.Versions(scope(ctx), req.Param("personaID"))
	if err != nil {
		return personaErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"versions": versions}}
}

func (h Handlers) Default(ctx access.Context, _ endpoint.Request) endpoint.Response {
	record, err := h.personas.DefaultForUser(scope(ctx), ctx.User.ID)
	if err != nil {
		return personaErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: record}
}

func (h Handlers) SetDefault(ctx access.Context, req endpoint.Request) endpoint.Response {
	var input struct {
		PersonaID string `json:"personaId"`
	}
	if err := req.Bind(&input); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	record, err := h.personas.SetDefault(scope(ctx), ctx.User.ID, input.PersonaID)
	if err != nil {
		return personaErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: record}
}

func (h Handlers) Tasks(ctx access.Context, req endpoint.Request) endpoint.Response {
	if _, err := h.personas.Get(scope(ctx), personacap.Selection{ID: req.Param("personaID")}); err != nil {
		return personaErr(err)
	}
	tasks, err := h.tasks.ListByPersona(agent.Scope{ProjectID: ctx.Project.ID}, req.Param("personaID"))
	if err != nil {
		return endpoint.Fail(http.StatusInternalServerError, "could not list persona tasks", err)
	}
	if tasks == nil {
		tasks = []agent.Task{}
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"tasks": tasks}}
}

func scope(ctx access.Context) personacap.Scope {
	return personacap.Scope{ProjectID: ctx.Project.ID}
}

func personaErr(err error) endpoint.Response {
	switch {
	case errors.Is(err, personacap.ErrNotFound), errors.Is(err, personacap.ErrProjectScope):
		return errResp(http.StatusNotFound, "persona not found")
	case errors.Is(err, personacap.ErrInvalid):
		return errResp(http.StatusBadRequest, "invalid persona request")
	case errors.Is(err, personacap.ErrAlreadyExists), errors.Is(err, personacap.ErrVersionConflict):
		return errResp(http.StatusConflict, "persona version conflict")
	case errors.Is(err, personacap.ErrManaged):
		return errResp(http.StatusForbidden, "General persona is managed by application configuration")
	default:
		return endpoint.Fail(http.StatusInternalServerError, "could not process persona request", err)
	}
}

func errResp(status int, message string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": message}}
}

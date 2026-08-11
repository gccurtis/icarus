// Package project implements the project application endpoints: listing and
// creating the projects a user may access, selecting one for the session (which
// produces the cell), and a project-scoped whoami that reports the resolved
// access context. All of these run within a resolved access Context.
package project

import (
	"errors"
	"net/http"

	"github.com/gccurtis/taurus-omega/core/access"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// Handlers holds the project endpoints, bound to the Access service they drive.
type Handlers struct {
	access *access.Access
}

// NewHandlers builds the project endpoints.
func NewHandlers(a *access.Access) Handlers { return Handlers{access: a} }

// List returns the projects the signed-in user is a member of. Requires a
// session.
func (h Handlers) List(ctx access.Context, _ endpoint.Request) endpoint.Response {
	projects, err := h.access.ProjectsForUser(ctx.User.ID)
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not list projects")
	}
	views := make([]projectJSON, 0, len(projects))
	for _, p := range projects {
		views = append(views, projectView(p))
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"projects": views}}
}

// Create makes a new project owned by the signed-in user. Requires a session.
func (h Handlers) Create(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Name string `json:"name"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}

	p, err := h.access.CreateProject(ctx.User.ID, in.Name)
	if errors.Is(err, access.ErrInvalidName) {
		return errResp(http.StatusBadRequest, err.Error())
	}
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not create project")
	}
	return endpoint.Response{Status: http.StatusCreated, Body: projectView(p)}
}

// Select sets the session's active project (and creates its cell). Requires a
// session; the user must be a member of the project.
func (h Handlers) Select(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		ProjectID string `json:"projectId"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}

	if _, err := h.access.SelectProject(ctx.Session.ID, in.ProjectID); err != nil {
		if errors.Is(err, access.ErrForbidden) {
			return errResp(http.StatusForbidden, "not a member of that project")
		}
		return errResp(http.StatusInternalServerError, "could not select project")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{
		"status":    "project selected",
		"projectId": in.ProjectID,
	}}
}

// Whoami reports the resolved access context — user, project, and cell — proving
// a project-scoped request reaches the right cell. Requires a selected project.
func (h Handlers) Whoami(ctx access.Context, _ endpoint.Request) endpoint.Response {
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{
		"user":    userView(*ctx.User),
		"project": projectView(*ctx.Project),
		"cell": map[string]string{
			"userId":    ctx.Cell.UserID,
			"projectId": ctx.Cell.ProjectID,
		},
	}}
}

type userJSON struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func userView(u access.User) userJSON { return userJSON{ID: u.ID, Email: u.Email} }

type projectJSON struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	OwnerID string `json:"ownerId"`
}

func projectView(p access.Project) projectJSON {
	return projectJSON{ID: p.ID, Name: p.Name, OwnerID: p.OwnerID}
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
}

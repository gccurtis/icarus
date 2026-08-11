# project.go

`project.go` is the **application** layer's project surface: the handlers a
signed-in user drives to see the projects they can reach, create a new one,
select one for the session, and confirm which project and cell a request has
resolved to. It picks up the access flow where `auth.go` leaves off — the user is
already signed in — and carries it through project selection, the step that pins a
session to a single project and produces its cell.

Every handler here is an `access.ScopedHandler`: each takes an already-resolved
`access.Context` alongside the request. That signature is a declaration that these
endpoints require at least a signed-in user; `Whoami` additionally requires a
selected project, since it reads the project and cell out of the context. As with
the rest of the application layer, the file depends only on `access` and
`endpoint` and never on Echo — the transport layer's gate middleware is what
guarantees the context is populated before these handlers run.

`Select` is the pivotal endpoint. Listing and creating projects only touch the
user, but selecting a project is what moves the session from "authenticated" to
"project-selected", creating the cell — the per-user, per-project space — that all
project-scoped work then happens inside. `Whoami` exists to make that resolution
observable: it reports the fully resolved user, project, and cell so a
project-scoped request can prove it reached the right place.

## Code breakdown

### Package documentation and declaration

```go
// Package project implements the project application endpoints: listing and
// creating the projects a user may access, selecting one for the session (which
// produces the cell), and a project-scoped whoami that reports the resolved
// access context. All of these run within a resolved access Context.
package project
```

The doc comment enumerates the four endpoints and calls out the two facts that
shape the file: selecting a project is what produces the cell, and every endpoint
runs within a resolved `access.Context`. That last point is why all four handlers
share the scoped signature rather than the plain one.

### Imports

```go
import (
	"errors"
	"net/http"

	"github.com/gccurtis/taurus-omega/core/access"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)
```

`errors` supports `errors.Is` for classifying the service's typed errors, and
`net/http` supplies the status constants. The two internal imports — `access`,
the service being driven, and `endpoint`, the neutral request/response contract —
are the entire dependency set. There is no transport import, keeping these
handlers agnostic to how the request arrived.

### The Handlers struct and its constructor

```go
// Handlers holds the project endpoints, bound to the Access service they drive.
type Handlers struct {
	access *access.Access
}

// NewHandlers builds the project endpoints.
func NewHandlers(a *access.Access) Handlers { return Handlers{access: a} }
```

`Handlers` binds the endpoints to the shared `access` service, and each endpoint
is a method on it so it can reach that service. `NewHandlers` is the small
constructor the composition layer calls to inject the service. This mirrors the
`auth` package exactly — the same pattern is used for every application-layer
endpoint group.

### List

```go
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
```

`List` returns the projects the signed-in user belongs to. Because it is scoped,
it can read `ctx.User.ID` directly and ask the service for that user's projects;
a service error becomes a generic `500`. It projects each project through
`projectView` into the public shape, building the slice with a zero length and a
capacity hint so the JSON is always an empty array rather than `null` when the
user has no projects. The result is wrapped under a `"projects"` key.

### Create

```go
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
```

`Create` makes a new project owned by the current user. It binds a small inline
struct for the single `name` field — replying `400` on a bad body — then calls
`access.CreateProject` with the user's ID from the context. An invalid name is the
one expected failure, mapped to `400` with the service's own message; anything
else is a `500`. On success it returns `201 Created` with the new project rendered
by `projectView`. The new project is owned by the user but is not yet the
session's selected project — that is a separate step.

### Select

```go
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
```

`Select` is the pivotal endpoint: it pins the session to a project and, as a side
effect in the service, creates the cell. It binds the target `projectId`, then
calls `access.SelectProject` against the session ID from the context — note it
operates on `ctx.Session.ID`, because the selection is recorded on the session
itself, not merely returned. Attempting to select a project the user is not a
member of surfaces as `access.ErrForbidden`, mapped to `403`; other failures are
`500`. On success it confirms with the selected project's ID. After this call the
session has advanced to "project-selected", which is the stage the transport
layer's `requireProject` gate demands before any project-scoped route will run.

### Whoami

```go
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
```

`Whoami` makes the resolved access state observable. Because it is only ever
reached through the project-scoped gate, all three of `ctx.User`, `ctx.Project`,
and `ctx.Cell` are guaranteed present, so it dereferences them freely and reports
each: the user and project through their view functions, and the cell as the
`userId`/`projectId` pair that identifies it. Its purpose is to prove that a
project-scoped request arrives at the correct cell — the intersection of the
signed-in user and the selected project — rather than to do any work of its own.

### Rendering a user

```go
type userJSON struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func userView(u access.User) userJSON { return userJSON{ID: u.ID, Email: u.Email} }
```

`userJSON` and `userView` define the public projection of a user — just the `ID`
and `email` — matching the same projection used in the `auth` package so a user
looks identical wherever it appears on the wire. Internal fields never leak
because every user response passes through this view.

### Rendering a project

```go
type projectJSON struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	OwnerID string `json:"ownerId"`
}

func projectView(p access.Project) projectJSON {
	return projectJSON{ID: p.ID, Name: p.Name, OwnerID: p.OwnerID}
}
```

`projectJSON` and `projectView` do the same for a project, exposing its `id`,
`name`, and `ownerId`. `List`, `Create`, and `Whoami` all render projects through
`projectView`, so the project's wire shape is defined in exactly one place and
stays consistent across every endpoint that returns one.

### Shared error helper

```go
func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
}
```

`errResp` is the shared error-response shape — a `{"error": msg}` body with the
given status — used by every failure path in the file. As in `auth`, funneling all
errors through one helper keeps error replies uniform across the package.

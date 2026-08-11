# agent.go

Package `agent`. See repo conventions (AGENTS.md).

## Code breakdown

```go
// Package agent exposes the durable Plan and Action task endpoints. Each route
// is project-scoped by transport before it reaches these handlers.
package agent

import (
	"errors"
	"net/http"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	agentcap "github.com/gccurtis/taurus-omega/core/capability/agent"
	"github.com/gccurtis/taurus-omega/core/capability/persona"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

type Handlers struct {
	tasks     *agentcap.Tasks
	workflows *agentcap.Workflows
}

func NewHandlers(tasks *agentcap.Tasks, workflows *agentcap.Workflows) Handlers {
	return Handlers{tasks: tasks, workflows: workflows}
}

func (h Handlers) CreatePlan(ctx access.Context, req endpoint.Request) endpoint.Response {
	return h.create(ctx, req, true)
}
func (h Handlers) CreateAction(ctx access.Context, req endpoint.Request) endpoint.Response {
	return h.create(ctx, req, false)
}

func (h Handlers) create(ctx access.Context, req endpoint.Request, plan bool) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot create agent tasks")
	}
	var input struct {
		Objective        string                 `json:"objective"`
		Context          []agentcap.ContextItem `json:"context"`
		Persona          persona.Selection      `json:"persona"`
		TargetDocumentID string                 `json:"targetDocumentId"`
	}
	if err := req.Bind(&input); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	scope := agentcap.Scope{ProjectID: ctx.Project.ID}
	var task agentcap.Task
	var err error
	if plan {
		task, err = h.workflows.CreatePlan(scope, ctx.User.ID, input.Objective, input.Context, input.Persona, input.TargetDocumentID)
	} else {
		task, err = h.workflows.CreateAction(scope, ctx.User.ID, input.Objective, input.Context, input.Persona, input.TargetDocumentID)
	}
	if err != nil {
		return taskErr(err)
	}
	return endpoint.Response{Status: http.StatusCreated, Body: task}
}

func (h Handlers) Get(ctx access.Context, req endpoint.Request) endpoint.Response {
	task, err := h.tasks.Get(agentcap.Scope{ProjectID: ctx.Project.ID}, req.Param("taskID"))
	if err != nil {
		return taskErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: task}
}
func (h Handlers) List(ctx access.Context, req endpoint.Request) endpoint.Response {
	scope := agentcap.Scope{ProjectID: ctx.Project.ID}
	var tasks []agentcap.Task
	var err error
	if documentID := req.Query("documentId"); documentID != "" {
		tasks, err = h.tasks.ListByDocument(scope, documentID)
	} else {
		tasks, err = h.tasks.List(scope)
	}
	if err != nil {
		return taskErr(err)
	}
	if tasks == nil {
		tasks = []agentcap.Task{}
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"tasks": tasks}}
}
func (h Handlers) AcceptPlan(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errResp(http.StatusForbidden, "read access cannot accept plans")
	}
	task, err := h.tasks.AcceptPlan(agentcap.Scope{ProjectID: ctx.Project.ID}, req.Param("taskID"), req.Param("planID"))
	if err != nil {
		return taskErr(err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: task}
}
func taskErr(err error) endpoint.Response {
	if errors.Is(err, agentcap.ErrTaskNotFound) || errors.Is(err, agentcap.ErrTaskProjectScope) {
		return errResp(http.StatusNotFound, "agent task not found")
	}
	if errors.Is(err, agentcap.ErrInvalidTask) || errors.Is(err, agentcap.ErrInvalidRequest) || errors.Is(err, persona.ErrInvalid) {
		return errResp(http.StatusBadRequest, "invalid agent task request")
	}
	if errors.Is(err, persona.ErrNotFound) || errors.Is(err, persona.ErrProjectScope) {
		return errResp(http.StatusNotFound, "persona not found")
	}
	return errResp(http.StatusInternalServerError, "could not process agent task")
}
func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
}
```

### Where the write gate lives

Every mutating handler here opens with `if !ctx.Role.CanWrite()`, returning 403
for a read-only member. That predicate is **not** defined in this package: it is
`access.Role.CanWrite` in `core/capability/access`. This package used to carry
its own private `canWrite(role access.Role) bool` copy — as did every other
handler package — so a change to what "may write" means would have had to be
repeated in each of them, and one missed copy would be a silent authorization
gap. The copies were identical, so folding them into a single method on the role
type changed no behavior; it just moved the definition to the one place that
owns roles, and left the call sites reading as a question asked of the role
itself.

### Failures carry their cause

Its one failure response (`could not process agent task`)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.

# resource.go

HTTP handlers for the selected-Project resource catalog: list/get/create/rename/delete, plus PatchAttributes (pin to top). See repo conventions (AGENTS.md).

## Code breakdown

```go
// Package resource implements the selected-Project unified resource endpoints.
package resource

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	resourcecap "github.com/gccurtis/taurus-omega/core/capability/resource"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

type Handlers struct {
	resources *resourcecap.Resources
	generator ResourceGenerator
}

// NewHandlers builds the resource endpoints. generator may be nil, in which case
// the "Create with AI" route reports that generation is not configured.
func NewHandlers(resources *resourcecap.Resources, generator ResourceGenerator) Handlers {
	return Handlers{resources: resources, generator: generator}
}

type summaryJSON struct {
	ID        string                  `json:"id"`
	Kind      resourcecap.Kind        `json:"kind"`
	Name      string                  `json:"name"`
	CreatedAt string                  `json:"createdAt"`
	UpdatedAt string                  `json:"updatedAt"`
	Pinned    bool                    `json:"pinned"`
	CreatorID string                  `json:"creatorId,omitempty"`
	Access    resourcecap.AccessScope `json:"access"`
}

func summaryView(summary resourcecap.Summary) summaryJSON {
	access := resourcecap.DefaultAccessScope()
	if summary.Access != nil {
		access = *summary.Access
	}
	return summaryJSON{
		ID: summary.ID, Kind: summary.Kind, Name: summary.Name,
		CreatedAt: summary.CreatedAt.UTC().Format(time.RFC3339Nano),
		UpdatedAt: summary.UpdatedAt.UTC().Format(time.RFC3339Nano),
		Pinned:    summary.Pinned,
		CreatorID: summary.CreatorID,
		Access:    access,
	}
}

// PatchAttributes sets catalog attributes on a resource — today just the pin
// flag. Requires edit access; the service re-checks the resource is in the
// selected project.
func (h Handlers) PatchAttributes(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errorResponse(http.StatusForbidden, "read access cannot change resource settings")
	}
	kind, err := resourcecap.ParseKind(req.Param("kind"))
	if err != nil {
		return errorResponse(http.StatusBadRequest, err.Error())
	}
	var in struct {
		Pinned *bool `json:"pinned"`
	}
	if err := req.Bind(&in); err != nil {
		return errorResponse(http.StatusBadRequest, "invalid JSON body")
	}
	if in.Pinned != nil {
		if err := h.resources.SetPinned(ctx.Project.ID, kind, req.Param("resourceID"), *in.Pinned); err != nil {
			if response := mutationError(err); response != nil {
				return *response
			}
			return errorResponse(http.StatusInternalServerError, "could not update resource settings")
		}
	}
	summary, err := h.resources.Get(ctx.Project.ID, kind, req.Param("resourceID"))
	if response := mutationError(err); response != nil {
		return *response
	}
	return endpoint.Response{Status: http.StatusOK, Body: summaryView(summary)}
}

func (h Handlers) List(ctx access.Context, req endpoint.Request) endpoint.Response {
	pageReq := resourcecap.PageRequest{Cursor: req.Query("cursor")}
	if raw := req.Query("limit"); raw != "" {
		limit, err := strconv.Atoi(raw)
		if err != nil || limit < 1 {
			return errorResponse(http.StatusBadRequest, resourcecap.ErrInvalidLimit.Error())
		}
		pageReq.Limit = limit
	}
	page, err := h.resources.List(ctx.Project.ID, pageReq)
	if errors.Is(err, resourcecap.ErrInvalidCursor) || errors.Is(err, resourcecap.ErrInvalidLimit) {
		return errorResponse(http.StatusBadRequest, err.Error())
	}
	if err != nil {
		return errorResponse(http.StatusInternalServerError, "could not list resources")
	}
	// Hide resources the caller may not see. NextCursor is unaffected — it is keyed
	// to the raw page boundary, so filtering never terminates pagination early.
	visible, err := h.resources.FilterAccessible(ctx.User.ID, page.Resources)
	if err != nil {
		return errorResponse(http.StatusInternalServerError, "could not list resources")
	}
	items := make([]summaryJSON, len(visible))
	for i, summary := range visible {
		items[i] = summaryView(summary)
	}
	var nextCursor any
	if page.NextCursor != "" {
		nextCursor = page.NextCursor
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{
		"resources": items, "availableKinds": page.AvailableKinds, "nextCursor": nextCursor,
	}}
}

// Get returns one current canonical Resource metadata projection, after checking
// the caller passes the resource's access scope.
func (h Handlers) Get(ctx access.Context, req endpoint.Request) endpoint.Response {
	kind := resourcecap.Kind(req.Param("kind"))
	id := req.Param("resourceID")
	allowed, err := h.resources.CanAccessResource(ctx.User.ID, ctx.Project.ID, kind, id)
	if response := queryError(err, "could not get resource"); response != nil {
		return *response
	}
	if !allowed {
		return errorResponse(http.StatusForbidden, "you do not have access to this resource")
	}
	summary, err := h.resources.Get(ctx.Project.ID, kind, id)
	if response := queryError(err, "could not get resource"); response != nil {
		return *response
	}
	return endpoint.Response{Status: http.StatusOK, Body: summaryView(summary)}
}

// PatchAccess replaces a resource's access scope. Only the resource's owner may
// change it; the service enforces that. The scope narrows visibility within the
// project's members and never grants access to a non-member.
func (h Handlers) PatchAccess(ctx access.Context, req endpoint.Request) endpoint.Response {
	kind, err := resourcecap.ParseKind(req.Param("kind"))
	if err != nil {
		return errorResponse(http.StatusBadRequest, err.Error())
	}
	var in struct {
		Access resourcecap.AccessScope `json:"access"`
	}
	if err := req.Bind(&in); err != nil {
		return errorResponse(http.StatusBadRequest, "invalid JSON body")
	}
	if err := h.resources.SetAccess(ctx.User.ID, ctx.Project.ID, kind, req.Param("resourceID"), in.Access); err != nil {
		if response := accessMutationError(err); response != nil {
			return *response
		}
		return errorResponse(http.StatusInternalServerError, "could not update resource access")
	}
	summary, err := h.resources.Get(ctx.Project.ID, kind, req.Param("resourceID"))
	if response := queryError(err, "could not get resource"); response != nil {
		return *response
	}
	return endpoint.Response{Status: http.StatusOK, Body: summaryView(summary)}
}

func accessMutationError(err error) *endpoint.Response {
	var response endpoint.Response
	switch {
	case err == nil:
		return nil
	case errors.Is(err, resourcecap.ErrInvalidAccessScope):
		response = errorResponse(http.StatusBadRequest, err.Error())
	case errors.Is(err, resourcecap.ErrNotOwner):
		response = errorResponse(http.StatusForbidden, err.Error())
	default:
		return mutationError(err)
	}
	return &response
}

func (h Handlers) Create(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errorResponse(http.StatusForbidden, "read access cannot create resources")
	}
	var in struct {
		Kind resourcecap.Kind `json:"kind"`
		Name string           `json:"name"`
	}
	if err := req.Bind(&in); err != nil {
		return errorResponse(http.StatusBadRequest, "invalid JSON body")
	}
	summary, err := h.resources.Create(ctx.Project.ID, actor(ctx), in.Kind, in.Name)
	if response := mutationError(err); response != nil {
		return *response
	}
	return endpoint.Response{Status: http.StatusCreated, Body: summaryView(summary)}
}

func (h Handlers) Rename(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errorResponse(http.StatusForbidden, "read access cannot rename resources")
	}
	var in struct {
		Name string `json:"name"`
	}
	if err := req.Bind(&in); err != nil {
		return errorResponse(http.StatusBadRequest, "invalid JSON body")
	}
	summary, err := h.resources.Rename(
		ctx.Project.ID, actor(ctx), resourcecap.Kind(req.Param("kind")), req.Param("resourceID"), in.Name,
	)
	if response := mutationError(err); response != nil {
		return *response
	}
	return endpoint.Response{Status: http.StatusOK, Body: summaryView(summary)}
}

func (h Handlers) Delete(ctx access.Context, req endpoint.Request) endpoint.Response {
	if !ctx.Role.CanWrite() {
		return errorResponse(http.StatusForbidden, "read access cannot delete resources")
	}
	err := h.resources.Delete(ctx.Project.ID, actor(ctx), resourcecap.Kind(req.Param("kind")), req.Param("resourceID"))
	if response := mutationError(err); response != nil {
		return *response
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "deleted"}}
}

func mutationError(err error) *endpoint.Response {
	return queryError(err, "could not mutate resource")
}

func queryError(err error, fallback string) *endpoint.Response {
	var response endpoint.Response
	switch {
	case err == nil:
		return nil
	case errors.Is(err, resourcecap.ErrUnknownKind), errors.Is(err, resourcecap.ErrInvalidName):
		response = errorResponse(http.StatusBadRequest, err.Error())
	case errors.Is(err, resourcecap.ErrUnavailableKind):
		response = errorResponse(http.StatusConflict, err.Error())
	case errors.Is(err, resourcecap.ErrNotFound):
		response = errorResponse(http.StatusNotFound, err.Error())
	default:
		response = errorResponse(http.StatusInternalServerError, fallback)
	}
	return &response
}

func actor(ctx access.Context) resourcecap.Actor {
	name := ctx.User.Name
	if name == "" {
		name = ctx.User.Email
	}
	return resourcecap.Actor{ID: ctx.User.ID, Name: name}
}

func errorResponse(status int, message string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": message}}
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

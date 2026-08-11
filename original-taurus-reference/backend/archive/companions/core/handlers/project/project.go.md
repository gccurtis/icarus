# project.go

This companion describes the current implementation of `core/handlers/project/project.go`. Its source blocks are presented in order and reproduce the Go file verbatim.

## Code breakdown

### Source block 1: package project

```go
// Package project implements the project application endpoints: listing the
// projects a user belongs to (with their role), creating a project, deleting one
// (owner only), leaving one, selecting one for the session (which produces the
// cell), and reporting the current selection. All of these run within a resolved
// access Context.
package project

import (
	"errors"
	"net/http"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 2: type Handlers struct {

```go
// Handlers holds the project endpoints, bound to the Access service they drive.
type Handlers struct {
	access   *access.Access
	activity ProjectActivityReader
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 3: type ProjectActivityReader interface {

```go
// ProjectActivityReader supplies the latest committed resource effect for each
// requested Project without coupling Access to the Activity capability.
type ProjectActivityReader interface {
	LatestByProjects(projectIDs []string) (map[string]time.Time, error)
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 4: func NewHandlers(a *access.Access, activity ...ProjectActivityReader) Handlers {

```go
// NewHandlers builds the project endpoints. Activity is optional for isolated
// tests; production composition supplies it to provide aggregate updatedAt.
func NewHandlers(a *access.Access, activity ...ProjectActivityReader) Handlers {
	h := Handlers{access: a}
	if len(activity) > 0 {
		h.activity = activity[0]
	}
	return h
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 5: type projectJSON struct {

```go
type projectJSON struct {
	ID         string             `json:"id"`
	Name       string             `json:"name"`
	Role       string             `json:"role"`
	Icon       string             `json:"icon"`
	Purpose    string             `json:"purpose"`
	Visibility string             `json:"visibility"`
	CreatedAt  string             `json:"createdAt"`
	UpdatedAt  string             `json:"updatedAt"`
	Members    membersSummaryJSON `json:"members"`
}

// membersSummaryJSON is the bounded avatar-cluster projection returned with each
// project: a small stack of public-safe members plus the exact total.
type membersSummaryJSON struct {
	Items []memberSummaryJSON `json:"items"`
	Total int                 `json:"total"`
}

type memberSummaryJSON struct {
	UserID    string `json:"userId"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatarUrl"`
}

func membersSummaryView(s access.ProjectMemberSummary) membersSummaryJSON {
	items := make([]memberSummaryJSON, 0, len(s.Items))
	for _, m := range s.Items {
		items = append(items, memberSummaryJSON{UserID: m.UserID, Name: m.Name, AvatarURL: m.AvatarURL})
	}
	return membersSummaryJSON{Items: items, Total: s.Total}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 6: func view(p access.Project, role access.Role, updatedAt time.Time) projectJSON {

```go
func view(p access.Project, role access.Role, updatedAt time.Time) projectJSON {
	return projectJSON{
		ID:         p.ID,
		Name:       p.Name,
		Role:       string(role),
		Icon:       p.Icon,
		Purpose:    p.Purpose,
		Visibility: string(p.Visibility),
		CreatedAt:  p.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:  updatedAt.UTC().Format(time.RFC3339Nano),
	}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 7: func (h Handlers) views(projects []access.ProjectMembership) ([]projectJSON, error) {

```go
func (h Handlers) views(projects []access.ProjectMembership) ([]projectJSON, error) {
	ids := make([]string, len(projects))
	for i, project := range projects {
		ids[i] = project.Project.ID
	}
	latest := map[string]time.Time{}
	var err error
	if h.activity != nil {
		latest, err = h.activity.LatestByProjects(ids)
		if err != nil {
			return nil, err
		}
	}
	summaries, err := h.access.MembersSummaryByProjects(ids, access.DefaultMemberStackSize)
	if err != nil {
		return nil, err
	}
	out := make([]projectJSON, len(projects))
	for i, project := range projects {
		updatedAt := project.Project.UpdatedAt
		if resourceAt := latest[project.Project.ID]; resourceAt.After(updatedAt) {
			updatedAt = resourceAt
		}
		out[i] = view(project.Project, project.Role, updatedAt)
		out[i].Members = membersSummaryView(summaries[project.Project.ID])
	}
	return out, nil
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 8: func (h Handlers) oneView(p access.Project, role access.Role) (projectJSON, error) {

```go
func (h Handlers) oneView(p access.Project, role access.Role) (projectJSON, error) {
	views, err := h.views([]access.ProjectMembership{{Project: p, Role: role}})
	if err != nil {
		return projectJSON{}, err
	}
	return views[0], nil
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 9: type memberJSON struct {

```go
type memberJSON struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 10: func memberView(m access.ProjectMember) memberJSON {

```go
func memberView(m access.ProjectMember) memberJSON {
	return memberJSON{UserID: m.UserID, Name: m.Name, Email: m.Email, Role: string(m.Role)}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 11: type linkJSON struct {

```go
type linkJSON struct {
	Role  string `json:"role"`
	Token string `json:"token"`
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 12: func linkView(l access.ProjectLink) linkJSON {

```go
func linkView(l access.ProjectLink) linkJSON {
	return linkJSON{Role: string(l.Role), Token: l.Token}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 13: func (h Handlers) List(ctx access.Context, _ endpoint.Request) endpoint.Response {

```go
// List returns the projects the user is a member of, each with the user's role.
func (h Handlers) List(ctx access.Context, _ endpoint.Request) endpoint.Response {
	pms, err := h.access.ProjectsForUser(ctx.User.ID)
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not list projects")
	}
	out, err := h.views(pms)
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not determine project activity")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"projects": out}}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 14: func (h Handlers) Create(ctx access.Context, req endpoint.Request) endpoint.Response {

```go
// Create makes a new project owned by the caller.
func (h Handlers) Create(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Name string `json:"name"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}

	p, err := h.access.CreateProject(ctx.User.ID, in.Name)
	if errors.Is(err, access.ErrInvalidName) {
		return errResp(http.StatusBadRequest, "project name must not be empty")
	}
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not create project")
	}
	body, err := h.oneView(p, access.RoleOwner)
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not determine project activity")
	}
	return endpoint.Response{Status: http.StatusCreated, Body: body}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 15: func (h Handlers) Update(ctx access.Context, req endpoint.Request) endpoint.Response {

```go
// Update applies a role-appropriate partial Project profile change.
func (h Handlers) Update(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Name       *string `json:"name"`
		Icon       *string `json:"icon"`
		Purpose    *string `json:"purpose"`
		Visibility *string `json:"visibility"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}

	p, role, err := h.access.UpdateProject(ctx.User.ID, req.Param("projectID"),
		access.ProjectChanges{Name: in.Name, Icon: in.Icon, Purpose: in.Purpose, Visibility: in.Visibility})
	switch {
	case errors.Is(err, access.ErrForbidden):
		return errResp(http.StatusForbidden, "your role cannot update the requested project fields")
	case errors.Is(err, access.ErrNoProjectChanges):
		return errResp(http.StatusBadRequest, err.Error())
	case errors.Is(err, access.ErrInvalidName):
		return errResp(http.StatusBadRequest, "project name must not be empty")
	case errors.Is(err, access.ErrInvalidIcon):
		return errResp(http.StatusBadRequest, "project icon is too long")
	case errors.Is(err, access.ErrInvalidPurpose):
		return errResp(http.StatusBadRequest, err.Error())
	case errors.Is(err, access.ErrInvalidVisibility):
		return errResp(http.StatusBadRequest, err.Error())
	case errors.Is(err, access.ErrNotFound):
		return errResp(http.StatusNotFound, "project not found")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not update project")
	}
	body, err := h.oneView(p, role)
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not determine project activity")
	}
	return endpoint.Response{Status: http.StatusOK, Body: body}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 16: func (h Handlers) Delete(ctx access.Context, req endpoint.Request) endpoint.Response {

```go
// Delete removes a project entirely. Only an owner may do this.
func (h Handlers) Delete(ctx access.Context, req endpoint.Request) endpoint.Response {
	switch err := h.access.DeleteProject(ctx.User.ID, req.Param("projectID")); {
	case errors.Is(err, access.ErrForbidden):
		return errResp(http.StatusForbidden, "only an owner can delete this project")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not delete project")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "deleted"}}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 17: func (h Handlers) Leave(ctx access.Context, req endpoint.Request) endpoint.Response {

```go
// Leave removes the caller from a project without deleting it.
func (h Handlers) Leave(ctx access.Context, req endpoint.Request) endpoint.Response {
	switch err := h.access.LeaveProject(ctx.User.ID, req.Param("projectID")); {
	case errors.Is(err, access.ErrNotFound):
		return errResp(http.StatusNotFound, "not a member of that project")
	case errors.Is(err, access.ErrLastOwner):
		return errResp(http.StatusConflict, "a project must keep at least one owner; delete it or hand off ownership first")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not leave project")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "left"}}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 18: func (h Handlers) Members(ctx access.Context, req endpoint.Request) endpoint.Response {

```go
// Members lists the members of a project. Any member may read it.
func (h Handlers) Members(ctx access.Context, req endpoint.Request) endpoint.Response {
	ms, err := h.access.ProjectMembers(ctx.User.ID, req.Param("projectID"))
	switch {
	case errors.Is(err, access.ErrForbidden):
		return errResp(http.StatusForbidden, "not a member of that project")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not list members")
	}
	out := make([]memberJSON, 0, len(ms))
	for _, m := range ms {
		out = append(out, memberView(m))
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"members": out}}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 19: func (h Handlers) AddMember(ctx access.Context, req endpoint.Request) endpoint.Response {

```go
// AddMember adds an existing user (by email) to a project at a role. Owner only.
func (h Handlers) AddMember(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	m, err := h.access.AddProjectMember(ctx.User.ID, req.Param("projectID"), in.Email, access.Role(in.Role))
	switch {
	case errors.Is(err, access.ErrForbidden):
		return errResp(http.StatusForbidden, "only an owner can add members")
	case errors.Is(err, access.ErrInvalidRole):
		return errResp(http.StatusBadRequest, err.Error())
	case errors.Is(err, access.ErrNotFound):
		return errResp(http.StatusNotFound, "no account with that email")
	case errors.Is(err, access.ErrAlreadyMember):
		return errResp(http.StatusConflict, "already a member of that project")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not add member")
	}
	return endpoint.Response{Status: http.StatusCreated, Body: memberView(m)}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 20: func (h Handlers) SetMemberRole(ctx access.Context, req endpoint.Request) endpoint.Response {

```go
// SetMemberRole changes a member's role. Owner only.
func (h Handlers) SetMemberRole(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Role string `json:"role"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	err := h.access.SetMemberRole(ctx.User.ID, req.Param("projectID"), req.Param("userID"), access.Role(in.Role))
	switch {
	case errors.Is(err, access.ErrForbidden):
		return errResp(http.StatusForbidden, "only an owner can change roles")
	case errors.Is(err, access.ErrInvalidRole):
		return errResp(http.StatusBadRequest, err.Error())
	case errors.Is(err, access.ErrLastOwner):
		return errResp(http.StatusConflict, err.Error())
	case errors.Is(err, access.ErrNotFound):
		return errResp(http.StatusNotFound, "not a member of that project")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not change role")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "updated"}}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 21: func (h Handlers) RemoveMember(ctx access.Context, req endpoint.Request) endpoint.Response {

```go
// RemoveMember removes a member from a project. Owner only.
func (h Handlers) RemoveMember(ctx access.Context, req endpoint.Request) endpoint.Response {
	err := h.access.RemoveMember(ctx.User.ID, req.Param("projectID"), req.Param("userID"))
	switch {
	case errors.Is(err, access.ErrForbidden):
		return errResp(http.StatusForbidden, "only an owner can remove members")
	case errors.Is(err, access.ErrLastOwner):
		return errResp(http.StatusConflict, err.Error())
	case errors.Is(err, access.ErrNotFound):
		return errResp(http.StatusNotFound, "not a member of that project")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not remove member")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "removed"}}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 22: func (h Handlers) Select(ctx access.Context, req endpoint.Request) endpoint.Response {

```go
// Select sets the session's active project (creating its cell). The caller must
// be a member.
func (h Handlers) Select(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		ProjectID string `json:"projectId"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}

	switch _, err := h.access.SelectProject(ctx.Session.ID, in.ProjectID); {
	case errors.Is(err, access.ErrForbidden):
		return errResp(http.StatusForbidden, "not a member of that project")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not select project")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{
		"status":    "selected",
		"projectId": in.ProjectID,
	}}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 23: func (h Handlers) Links(ctx access.Context, req endpoint.Request) endpoint.Response {

```go
// Links lists a project's active share links (read/edit). Owner only.
func (h Handlers) Links(ctx access.Context, req endpoint.Request) endpoint.Response {
	links, err := h.access.ProjectLinks(ctx.User.ID, req.Param("projectID"))
	switch {
	case errors.Is(err, access.ErrForbidden):
		return errResp(http.StatusForbidden, "only an owner can manage share links")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not list share links")
	}
	out := make([]linkJSON, 0, len(links))
	for _, l := range links {
		out = append(out, linkView(l))
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"links": out}}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 24: func (h Handlers) RotateLink(ctx access.Context, req endpoint.Request) endpoint.Response {

```go
// RotateLink creates or rotates the share link for a role (read|edit). Owner only.
func (h Handlers) RotateLink(ctx access.Context, req endpoint.Request) endpoint.Response {
	l, err := h.access.CreateOrRotateProjectLink(ctx.User.ID, req.Param("projectID"), access.Role(req.Param("role")))
	switch {
	case errors.Is(err, access.ErrInvalidLinkRole):
		return errResp(http.StatusBadRequest, err.Error())
	case errors.Is(err, access.ErrForbidden):
		return errResp(http.StatusForbidden, "only an owner can manage share links")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not create share link")
	}
	return endpoint.Response{Status: http.StatusOK, Body: linkView(l)}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 25: func (h Handlers) DeleteLink(ctx access.Context, req endpoint.Request) endpoint.Response {

```go
// DeleteLink turns off the share link for a role. Owner only.
func (h Handlers) DeleteLink(ctx access.Context, req endpoint.Request) endpoint.Response {
	err := h.access.DeleteProjectLink(ctx.User.ID, req.Param("projectID"), access.Role(req.Param("role")))
	switch {
	case errors.Is(err, access.ErrInvalidLinkRole):
		return errResp(http.StatusBadRequest, err.Error())
	case errors.Is(err, access.ErrForbidden):
		return errResp(http.StatusForbidden, "only an owner can manage share links")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not delete share link")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]string{"status": "deleted"}}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 26: func (h Handlers) JoinByToken(ctx access.Context, req endpoint.Request) endpoint.Response {

```go
// JoinByToken joins a project via a share-link token, granting (or upgrading to)
// the link's role. An unknown or disabled token is a 404 — never revealing a
// project to someone without a working link.
func (h Handlers) JoinByToken(ctx access.Context, req endpoint.Request) endpoint.Response {
	p, role, err := h.access.JoinByLink(ctx.User.ID, req.Param("token"))
	switch {
	case errors.Is(err, access.ErrNotFound):
		return errResp(http.StatusNotFound, "link not found")
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not join project")
	}
	body, err := h.oneView(p, role)
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not determine project activity")
	}
	return endpoint.Response{Status: http.StatusOK, Body: body}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 27: func (h Handlers) Current(ctx access.Context, _ endpoint.Request) endpoint.Response {

```go
// Current reports the session's currently selected project, if any.
func (h Handlers) Current(ctx access.Context, _ endpoint.Request) endpoint.Response {
	if !ctx.HasProject() {
		return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"selected": false}}
	}
	body, err := h.oneView(*ctx.Project, ctx.Role)
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not determine project activity")
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{
		"selected": true,
		"project":  body,
	}}
}

```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Source block 28: func errResp(status int, msg string) endpoint.Response {

```go
func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
}
```

This block defines that part of the implementation and keeps its current behavior visible alongside the source.

### Failures carry their cause

Its 19 failure responses (`could not list projects`, and the rest)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.

// Package organization implements the above-Project organization endpoints:
// creating organizations, listing the caller's own, and managing memberships.
// These routes are gated on a signed-in user but deliberately not scoped to a
// selected Project, because an organization spans Projects.
package organization

import (
	"errors"
	"net/http"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	organizationcap "github.com/gccurtis/taurus-omega/core/capability/organization"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

type Handlers struct {
	organizations *organizationcap.Organizations
}

func NewHandlers(o *organizationcap.Organizations) Handlers { return Handlers{organizations: o} }

type orgJSON struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Role      string `json:"role,omitempty"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

type memberJSON struct {
	UserID string `json:"userId"`
	Role   string `json:"role"`
}

// Create records a new organization owned by the caller.
func (h Handlers) Create(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Name string `json:"name"`
	}
	if err := req.Bind(&in); err != nil {
		return errorResponse(http.StatusBadRequest, "invalid JSON body")
	}
	org, err := h.organizations.Create(ctx.User.ID, in.Name)
	if resp := orgError(err); resp != nil {
		return *resp
	}
	return endpoint.Response{Status: http.StatusCreated, Body: orgView(org, organizationcap.RoleOwner)}
}

// List returns the organizations the caller belongs to.
func (h Handlers) List(ctx access.Context, _ endpoint.Request) endpoint.Response {
	mine, err := h.organizations.ListMine(ctx.User.ID)
	if resp := orgError(err); resp != nil {
		return *resp
	}
	out := make([]orgJSON, len(mine))
	for i, m := range mine {
		out[i] = orgView(m.Organization, m.Role)
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"organizations": out}}
}

// Rename changes an organization's name (owner/admin only).
func (h Handlers) Rename(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Name string `json:"name"`
	}
	if err := req.Bind(&in); err != nil {
		return errorResponse(http.StatusBadRequest, "invalid JSON body")
	}
	org, err := h.organizations.Rename(ctx.User.ID, req.Param("orgID"), in.Name)
	if resp := orgError(err); resp != nil {
		return *resp
	}
	return endpoint.Response{Status: http.StatusOK, Body: orgView(org, "")}
}

// Members lists an organization's memberships (members only).
func (h Handlers) Members(ctx access.Context, req endpoint.Request) endpoint.Response {
	members, err := h.organizations.Members(ctx.User.ID, req.Param("orgID"))
	if resp := orgError(err); resp != nil {
		return *resp
	}
	out := make([]memberJSON, len(members))
	for i, m := range members {
		out[i] = memberJSON{UserID: m.UserID, Role: string(m.Role)}
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"members": out}}
}

// AddMember adds a user to an organization (owner/admin; owner role owner-only).
func (h Handlers) AddMember(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		UserID string `json:"userId"`
		Role   string `json:"role"`
	}
	if err := req.Bind(&in); err != nil {
		return errorResponse(http.StatusBadRequest, "invalid JSON body")
	}
	member, err := h.organizations.AddMember(ctx.User.ID, req.Param("orgID"), in.UserID, organizationcap.Role(in.Role))
	if resp := orgError(err); resp != nil {
		return *resp
	}
	return endpoint.Response{Status: http.StatusCreated, Body: memberJSON{UserID: member.UserID, Role: string(member.Role)}}
}

// SetRole changes a member's role.
func (h Handlers) SetRole(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Role string `json:"role"`
	}
	if err := req.Bind(&in); err != nil {
		return errorResponse(http.StatusBadRequest, "invalid JSON body")
	}
	if err := h.organizations.SetRole(ctx.User.ID, req.Param("orgID"), req.Param("userID"), organizationcap.Role(in.Role)); err != nil {
		if resp := orgError(err); resp != nil {
			return *resp
		}
	}
	return endpoint.Response{Status: http.StatusNoContent}
}

// RemoveMember removes a user from an organization.
func (h Handlers) RemoveMember(ctx access.Context, req endpoint.Request) endpoint.Response {
	if err := h.organizations.RemoveMember(ctx.User.ID, req.Param("orgID"), req.Param("userID")); err != nil {
		if resp := orgError(err); resp != nil {
			return *resp
		}
	}
	return endpoint.Response{Status: http.StatusNoContent}
}

func orgView(org organizationcap.Organization, role organizationcap.Role) orgJSON {
	return orgJSON{
		ID: org.ID, Name: org.Name, Role: string(role),
		CreatedAt: org.CreatedAt.UTC().Format(time.RFC3339Nano), UpdatedAt: org.UpdatedAt.UTC().Format(time.RFC3339Nano),
	}
}

func orgError(err error) *endpoint.Response {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, organizationcap.ErrInvalidName), errors.Is(err, organizationcap.ErrInvalidRole), errors.Is(err, organizationcap.ErrNotMember):
		return responsePtr(errorResponse(http.StatusBadRequest, err.Error()))
	case errors.Is(err, organizationcap.ErrForbidden):
		return responsePtr(errorResponse(http.StatusForbidden, err.Error()))
	case errors.Is(err, organizationcap.ErrNotFound):
		return responsePtr(errorResponse(http.StatusNotFound, err.Error()))
	case errors.Is(err, organizationcap.ErrLastOwner):
		return responsePtr(errorResponse(http.StatusConflict, err.Error()))
	default:
		return responsePtr(errorResponse(http.StatusInternalServerError, "organization request failed"))
	}
}

func responsePtr(r endpoint.Response) *endpoint.Response { return &r }

func errorResponse(status int, message string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": message}}
}

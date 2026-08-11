# user.go

HTTP handler for the safe current-project user profile endpoint.

## Code breakdown

```go
// Package user implements the safe current-Project User profile query.
package user

import (
	"errors"
	"net/http"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// Handlers adapts bounded Access profile reads to HTTP.
type Handlers struct{ access *access.Access }

// NewHandlers binds User profile queries to Access.
func NewHandlers(a *access.Access) Handlers { return Handlers{access: a} }

type publicUserJSON struct {
	ID          string `json:"id"`
	Kind        string `json:"kind"`
	Name        string `json:"name"`
	Email       string `json:"email,omitempty"`
	Role        string `json:"role"`
	Description string `json:"description"`
	CreatedAt   string `json:"createdAt"`
	Color       string `json:"color,omitempty"`
	AvatarURL   string `json:"avatarUrl,omitempty"`
}

// Get returns a current selected-Project member's safe display profile.
func (h Handlers) Get(ctx access.Context, req endpoint.Request) endpoint.Response {
	u, err := h.access.PublicUserInProject(ctx.Project.ID, req.Param("userID"))
	switch {
	case errors.Is(err, access.ErrNotFound):
		return errorResponse(http.StatusNotFound, "user not found")
	case err != nil:
		return errorResponse(http.StatusInternalServerError, "could not get user")
	}
	return endpoint.Response{Status: http.StatusOK, Body: publicUserJSON{
		ID:          u.ID,
		Kind:        u.Kind,
		Name:        u.Name,
		Email:       u.Email,
		Role:        u.Role,
		Description: u.Description,
		CreatedAt:   u.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		Color:       u.Color,
		AvatarURL:   u.AvatarURL,
	}}
}

func errorResponse(status int, message string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": message}}
}
```

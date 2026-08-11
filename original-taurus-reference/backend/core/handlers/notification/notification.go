// Package notification implements the caller's ephemeral toast-drain endpoint.
package notification

import (
	"net/http"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	notificationcap "github.com/gccurtis/taurus-omega/core/capability/notification"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

type Handlers struct {
	notifications *notificationcap.Notifications
}

func NewHandlers(n *notificationcap.Notifications) Handlers { return Handlers{notifications: n} }

type toastJSON struct {
	ID        string                `json:"id"`
	Level     notificationcap.Level `json:"level"`
	Title     string                `json:"title"`
	Body      string                `json:"body,omitempty"`
	ProjectID string                `json:"projectId,omitempty"`
	CreatedAt string                `json:"createdAt"`
}

// Drain returns and clears the caller's pending toasts for the selected Project.
// It is destructive by contract: a toast is delivered exactly once.
func (h Handlers) Drain(ctx access.Context, _ endpoint.Request) endpoint.Response {
	toasts := h.notifications.Drain(ctx.Project.ID, ctx.User.ID)
	out := make([]toastJSON, len(toasts))
	for i, toast := range toasts {
		out[i] = toastJSON{
			ID: toast.ID, Level: toast.Level, Title: toast.Title, Body: toast.Body,
			ProjectID: toast.ProjectID, CreatedAt: toast.CreatedAt.UTC().Format(time.RFC3339Nano),
		}
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"notifications": out}}
}

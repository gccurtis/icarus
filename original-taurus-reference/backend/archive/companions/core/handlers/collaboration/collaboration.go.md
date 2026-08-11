# collaboration.go

Collaboration handlers: GET /documents/:id/collaboration returns a unified last-edit attribution (from the activity feed, spanning content changes and resource renames, falling back to creation) plus the bounded set of users currently viewing; PUT/DELETE /documents/:id/presence drive the ephemeral heartbeat. See repo conventions (AGENTS.md).

## Code breakdown

```go
// Package collaboration serves a document's collaboration projection (a unified
// last-edit attribution plus the users currently viewing it) and the ephemeral
// per-document presence heartbeat behind it.
package collaboration

import (
	"errors"
	"net/http"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	activitycap "github.com/gccurtis/taurus-omega/core/capability/activity"
	"github.com/gccurtis/taurus-omega/core/capability/document"
	presencecap "github.com/gccurtis/taurus-omega/core/capability/presence"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// Handlers serve the /documents/:documentID/collaboration and /presence routes.
type Handlers struct {
	documents *document.Documents
	activity  *activitycap.Activity
	presence  *presencecap.Presence
}

// NewHandlers constructs the collaboration handlers over the document, activity,
// and presence capabilities.
func NewHandlers(documents *document.Documents, activity *activitycap.Activity, presence *presencecap.Presence) Handlers {
	return Handlers{documents: documents, activity: activity, presence: presence}
}

type identityJSON struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
	Name string `json:"name"`
}

type lastEditJSON struct {
	At     string       `json:"at"`
	Actor  identityJSON `json:"actor"`
	Source string       `json:"source"`
}

type openUserJSON struct {
	Identity identityJSON `json:"identity"`
	Access   string       `json:"access"`
	SeenAt   string       `json:"seenAt"`
}

// Get returns a document's collaboration projection: the latest content change
// or resource rename (durable attribution from the activity feed, falling back
// to creation) plus the bounded set of users currently viewing it.
func (h Handlers) Get(ctx access.Context, req endpoint.Request) endpoint.Response {
	if ctx.Project == nil {
		return errResp(http.StatusBadRequest, "no project selected")
	}
	docID := req.Param("documentID")
	doc, err := h.documents.Get(ctx.Project.ID, docID)
	if errors.Is(err, document.ErrNotFound) {
		return errResp(http.StatusNotFound, "document not found")
	}
	if err != nil {
		return errResp(http.StatusInternalServerError, "could not load document")
	}

	lastEdit := h.lastEdit(ctx.Project.ID, doc)

	open := h.presence.Open(docID)
	openUsers := make([]openUserJSON, 0, len(open))
	for _, e := range open {
		openUsers = append(openUsers, openUserJSON{
			Identity: identityJSON{Kind: actorKind(e.UserID), ID: e.UserID, Name: e.Name},
			Access:   e.Access,
			SeenAt:   e.SeenAt.UTC().Format(time.RFC3339Nano),
		})
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{
		"lastEdit": lastEdit, "openUsers": openUsers,
	}}
}

// lastEdit resolves the document's latest mutation attribution from the newest
// activity event targeting it, falling back to the document's creation metadata.
func (h Handlers) lastEdit(projectID string, doc document.Document) lastEditJSON {
	page, err := h.activity.List(projectID, activitycap.PageRequest{TargetID: doc.ID, Limit: 1})
	if err == nil && len(page.Events) > 0 {
		e := page.Events[0]
		return lastEditJSON{
			At:     e.OccurredAt.UTC().Format(time.RFC3339Nano),
			Actor:  identityJSON{Kind: actorKind(e.Actor.ID), ID: e.Actor.ID, Name: e.Actor.Name},
			Source: source(e.Action),
		}
	}
	return lastEditJSON{
		At:     doc.CreatedAt.UTC().Format(time.RFC3339Nano),
		Actor:  identityJSON{Kind: actorKind(doc.CreatorID), ID: doc.CreatorID, Name: doc.CreatorName},
		Source: "created",
	}
}

// PutPresence records the caller's heartbeat on a document. Any project member
// may signal presence.
func (h Handlers) PutPresence(ctx access.Context, req endpoint.Request) endpoint.Response {
	if ctx.Project == nil {
		return errResp(http.StatusBadRequest, "no project selected")
	}
	docID := req.Param("documentID")
	if _, err := h.documents.Get(ctx.Project.ID, docID); err != nil {
		if errors.Is(err, document.ErrNotFound) {
			return errResp(http.StatusNotFound, "document not found")
		}
		return errResp(http.StatusInternalServerError, "could not load document")
	}
	h.presence.Touch(docID, ctx.User.ID, ctx.User.Name, string(ctx.Role))
	return endpoint.Response{Status: http.StatusNoContent}
}

// DeletePresence clears the caller's presence on a document (idempotent).
func (h Handlers) DeletePresence(ctx access.Context, req endpoint.Request) endpoint.Response {
	h.presence.Clear(req.Param("documentID"), ctx.User.ID)
	return endpoint.Response{Status: http.StatusNoContent}
}

// actorKind classifies an activity/presence actor id. The document system actor
// is "system"; everyone else is a user.
func actorKind(id string) string {
	if id == document.SystemActor.ID {
		return "system"
	}
	return "user"
}

// source maps an activity action to the collaboration lastEdit source label.
func source(action activitycap.Action) string {
	switch action {
	case activitycap.ActionEdited:
		return "document_change"
	case activitycap.ActionRenamed:
		return "resource_rename"
	case activitycap.ActionCreated:
		return "created"
	default:
		return string(action)
	}
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]any{"error": msg}}
}
```

### Failures carry their cause

Its 2 failure responses (`could not load document`, and the rest)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.

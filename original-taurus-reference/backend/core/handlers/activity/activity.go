// Package activity implements the Project-scoped Activity application endpoint.
package activity

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	activitycap "github.com/gccurtis/taurus-omega/core/capability/activity"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

type Handlers struct{ activity *activitycap.Activity }

func NewHandlers(a *activitycap.Activity) Handlers { return Handlers{activity: a} }

type eventJSON struct {
	ID         string                       `json:"id"`
	Actor      activitycap.ActorSnapshot    `json:"actor"`
	Action     activitycap.Action           `json:"action"`
	Target     activitycap.ResourceSnapshot `json:"target"`
	OccurredAt string                       `json:"occurredAt"`
}

// List returns the selected Project's newest semantic activity events. A
// targetID query parameter restricts the feed to one resource's events.
func (h Handlers) List(ctx access.Context, req endpoint.Request) endpoint.Response {
	pageReq := activitycap.PageRequest{Cursor: req.Query("cursor"), TargetID: req.Query("targetID")}
	if raw := req.Query("limit"); raw != "" {
		limit, err := strconv.Atoi(raw)
		if err != nil || limit < 1 {
			return errorResponse(http.StatusBadRequest, activitycap.ErrInvalidLimit.Error())
		}
		pageReq.Limit = limit
	}
	page, err := h.activity.List(ctx.Project.ID, pageReq)
	if errors.Is(err, activitycap.ErrInvalidCursor) || errors.Is(err, activitycap.ErrInvalidLimit) {
		return errorResponse(http.StatusBadRequest, err.Error())
	}
	if err != nil {
		return errorResponse(http.StatusInternalServerError, "could not list activity")
	}
	events := make([]eventJSON, len(page.Events))
	for i, event := range page.Events {
		events[i] = eventJSON{
			ID: event.ID, Actor: event.Actor, Action: event.Action, Target: event.Target,
			OccurredAt: event.OccurredAt.UTC().Format(time.RFC3339Nano),
		}
	}
	var nextCursor any
	if page.NextCursor != "" {
		nextCursor = page.NextCursor
	}
	return endpoint.Response{Status: http.StatusOK, Body: map[string]any{"events": events, "nextCursor": nextCursor}}
}

func errorResponse(status int, message string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": message}}
}

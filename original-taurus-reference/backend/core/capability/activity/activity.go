// Package activity provides the bounded, project-scoped semantic activity feed.
// Events are immutable snapshots of confirmed resource effects; this capability
// reads them but deliberately exposes no generic event-writing operation.
package activity

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"sort"
	"time"
)

const (
	DefaultLimit = 8
	MaxLimit     = 100
)

var (
	ErrInvalidCursor = errors.New("activity cursor is invalid")
	ErrInvalidLimit  = errors.New("activity limit must be between 1 and 100")
)

// Action is the closed vocabulary of user-visible resource effects.
type Action string

const (
	ActionCreated Action = "created"
	ActionEdited  Action = "edited"
	ActionRenamed Action = "renamed"
	ActionDeleted Action = "deleted"
)

// ActorSnapshot preserves who performed an effect as they were displayed then.
type ActorSnapshot struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// ResourceSnapshot preserves the safe identity and name of the affected target.
type ResourceSnapshot struct {
	ID   string `json:"id"`
	Kind string `json:"kind"`
	Name string `json:"name"`
}

// Event is one immutable semantic fact in a Project activity feed.
type Event struct {
	ID         string
	ProjectID  string
	Actor      ActorSnapshot
	Action     Action
	Target     ResourceSnapshot
	OccurredAt time.Time
	SourceKind string
	SourceID   string
}

// Boundary is the decoded keyset boundary passed to durable stores.
type Boundary struct {
	OccurredAt time.Time
	ID         string
}

// Store is the read side of Activity persistence.
type Store interface {
	// ListActivity returns a project's events newest-first. A non-empty targetID
	// restricts the feed to events whose target is that resource.
	ListActivity(projectID, targetID string, before *Boundary, limit int) ([]Event, error)
	LatestActivityByProjects(projectIDs []string) (map[string]time.Time, error)
}

// PageRequest describes a bounded page. A zero Limit selects DefaultLimit. A
// non-empty TargetID restricts the feed to one resource's events.
type PageRequest struct {
	Limit    int
	Cursor   string
	TargetID string
}

// Page is one event page and an optional keyset cursor for the next page.
type Page struct {
	Events     []Event
	NextCursor string
}

// Activity reads immutable facts through a Store.
type Activity struct{ store Store }

func New(store Store) *Activity { return &Activity{store: store} }

// List returns one stable keyset page in occurredAt-descending, id-descending
// order. Cursors are traversal boundaries, never authority.
func (a *Activity) List(projectID string, req PageRequest) (Page, error) {
	limit := req.Limit
	if limit == 0 {
		limit = DefaultLimit
	}
	if limit < 1 || limit > MaxLimit {
		return Page{}, ErrInvalidLimit
	}
	var boundary *Boundary
	if req.Cursor != "" {
		decoded, err := decodeCursor(req.Cursor)
		if err != nil {
			return Page{}, err
		}
		boundary = &decoded
	}
	events, err := a.store.ListActivity(projectID, req.TargetID, boundary, limit+1)
	if err != nil {
		return Page{}, err
	}
	page := Page{Events: events}
	if len(page.Events) > limit {
		page.Events = page.Events[:limit]
		page.NextCursor = encodeCursor(page.Events[len(page.Events)-1])
	}
	if page.Events == nil {
		page.Events = []Event{}
	}
	return page, nil
}

// LatestByProjects returns the newest event timestamp for each Project that has
// activity. Missing Project IDs are omitted.
func (a *Activity) LatestByProjects(projectIDs []string) (map[string]time.Time, error) {
	return a.store.LatestActivityByProjects(projectIDs)
}

type cursorPayload struct {
	Version int    `json:"v"`
	At      string `json:"at"`
	ID      string `json:"id"`
}

func encodeCursor(event Event) string {
	b, _ := json.Marshal(cursorPayload{Version: 1, At: event.OccurredAt.UTC().Format(time.RFC3339Nano), ID: event.ID})
	return base64.RawURLEncoding.EncodeToString(b)
}

func decodeCursor(cursor string) (Boundary, error) {
	b, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return Boundary{}, ErrInvalidCursor
	}
	dec := json.NewDecoder(bytes.NewReader(b))
	dec.DisallowUnknownFields()
	var payload cursorPayload
	if err := dec.Decode(&payload); err != nil {
		return Boundary{}, ErrInvalidCursor
	}
	if err := ensureEOF(dec); err != nil || payload.Version != 1 || payload.ID == "" {
		return Boundary{}, ErrInvalidCursor
	}
	at, err := time.Parse(time.RFC3339Nano, payload.At)
	if err != nil {
		return Boundary{}, ErrInvalidCursor
	}
	return Boundary{OccurredAt: at.UTC(), ID: payload.ID}, nil
}

func ensureEOF(dec *json.Decoder) error {
	var extra any
	if err := dec.Decode(&extra); !errors.Is(err, io.EOF) {
		return ErrInvalidCursor
	}
	return nil
}

// Sort orders events using Activity's canonical ordering.
func Sort(events []Event) {
	sort.Slice(events, func(i, j int) bool {
		if !events[i].OccurredAt.Equal(events[j].OccurredAt) {
			return events[i].OccurredAt.After(events[j].OccurredAt)
		}
		return events[i].ID > events[j].ID
	})
}

// Before reports whether event belongs after the keyset boundary.
func Before(event Event, boundary Boundary) bool {
	return event.OccurredAt.Before(boundary.OccurredAt) ||
		(event.OccurredAt.Equal(boundary.OccurredAt) && event.ID < boundary.ID)
}

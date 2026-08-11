// Package session provides per-user, per-project session tracking: an ephemeral
// observer layer that records user activity, caret position, and current
// document focus. Sessions feed up into the project-level activity feed.
//
// Session sits outside the document aggregate — document never imports session.
// Producers (HTTP middleware, completed async jobs) push events to a shared
// queue; a single consumer writes to durable storage. A sweeper removes stale
// sessions past a configurable timeout.
package session

import (
	"errors"
	"sync"
	"time"
)

// Session represents one user's active session within a project. One per user
// per project.
type Session struct {
	ProjectID            string    `json:"projectId"`
	UserID               string    `json:"userId"`
	SessionID            string    `json:"sessionId"`
	UserName             string    `json:"userName"`
	UserEmail            string    `json:"userEmail,omitempty"`
	CurrentDocumentID    string    `json:"currentDocumentId,omitempty"`
	CaretAtomID          string    `json:"caretAtomId,omitempty"`
	CaretOffset          int       `json:"caretOffset,omitempty"`
	SelectionStartAtomID string    `json:"selectionStartAtomId,omitempty"`
	SelectionStartOffset int       `json:"selectionStartOffset,omitempty"`
	SelectionEndAtomID   string    `json:"selectionEndAtomId,omitempty"`
	SelectionEndOffset   int       `json:"selectionEndOffset,omitempty"`
	StartedAt            time.Time `json:"startedAt"`
	LastActivityAt       time.Time `json:"lastActivityAt"`
}

// Event is a lightweight fact pushed to the session queue by a producer (HTTP
// middleware, async job completion handler). The consumer processes events to
// update session state.
type Event struct {
	ProjectID string
	UserID    string
	UserName  string
	Kind      string
	Timestamp time.Time
}

// Store is the durable session storage contract.
type Store interface {
	UpsertProjectSession(s Session) error
	CloseProjectSession(projectID, userID string) error
	UpdateProjectSession(s Session) error
	ListProjectSessions(projectID string) ([]Session, error)
	BumpProjectSessionActivity(projectID, userID string, t time.Time) error
	DeleteStaleProjectSessions(before time.Time) error
}

// Options configures the Sessions service.
type Options struct {
	StaleTimeout  time.Duration
	SweepInterval time.Duration
	QueueSize     int
}

// DefaultOptions returns sensible defaults.
func DefaultOptions() Options {
	return Options{
		StaleTimeout:  15 * time.Minute,
		SweepInterval: 60 * time.Second,
		QueueSize:     256,
	}
}

// Sessions manages the per-user, per-project session lifecycle. It owns a
// buffered event queue with a single consumer goroutine and a periodic sweeper
// that removes stale sessions.
type Sessions struct {
	store   Store
	opts    Options
	queue   chan Event
	done    chan struct{}
	stopped chan struct{}
	once    sync.Once
}

// New creates a Sessions service over the given store.
func New(store Store, opts Options) *Sessions {
	if opts.StaleTimeout <= 0 {
		opts.StaleTimeout = DefaultOptions().StaleTimeout
	}
	if opts.SweepInterval <= 0 {
		opts.SweepInterval = DefaultOptions().SweepInterval
	}
	if opts.QueueSize <= 0 {
		opts.QueueSize = DefaultOptions().QueueSize
	}
	s := &Sessions{
		store:   store,
		opts:    opts,
		queue:   make(chan Event, opts.QueueSize),
		done:    make(chan struct{}),
		stopped: make(chan struct{}),
	}
	go s.consume()
	go s.sweep()
	return s
}

// PushEvent enqueues a session event. It never blocks: if the queue is full the
// event is dropped rather than back-pressuring the producer. Safe to call after
// Stop — sends to a closed channel are silently dropped.
func (s *Sessions) PushEvent(e Event) {
	defer func() { recover() }()
	select {
	case s.queue <- e:
	default:
	}
}

// Start begins a session for the given user in the given project. It is an
// upsert: if a session already exists it is re-activated.
func (s *Sessions) Start(projectID, userID, userName, userEmail, sessionID string) (Session, error) {
	now := time.Now()
	sess := Session{
		ProjectID:      projectID,
		UserID:         userID,
		SessionID:      sessionID,
		UserName:       userName,
		UserEmail:      userEmail,
		StartedAt:      now,
		LastActivityAt: now,
	}
	err := s.store.UpsertProjectSession(sess)
	if err != nil {
		return Session{}, err
	}
	return sess, nil
}

// Close ends a session.
func (s *Sessions) Close(projectID, userID string) error {
	return s.store.CloseProjectSession(projectID, userID)
}

// Update writes the caller's current document, caret, and selection state.
func (s *Sessions) Update(projectID, userID string, in UpdateInput) error {
	now := time.Now()
	sess := Session{
		ProjectID:            projectID,
		UserID:               userID,
		CurrentDocumentID:    in.CurrentDocumentID,
		CaretAtomID:          in.CaretAtomID,
		CaretOffset:          in.CaretOffset,
		SelectionStartAtomID: in.SelectionStartAtomID,
		SelectionStartOffset: in.SelectionStartOffset,
		SelectionEndAtomID:   in.SelectionEndAtomID,
		SelectionEndOffset:   in.SelectionEndOffset,
		LastActivityAt:       now,
	}
	return s.store.UpdateProjectSession(sess)
}

// UpdateInput carries the mutable fields of a session update.
type UpdateInput struct {
	CurrentDocumentID    string `json:"currentDocumentId"`
	CaretAtomID          string `json:"caretAtomId"`
	CaretOffset          int    `json:"caretOffset"`
	SelectionStartAtomID string `json:"selectionStartAtomId"`
	SelectionStartOffset int    `json:"selectionStartOffset"`
	SelectionEndAtomID   string `json:"selectionEndAtomId"`
	SelectionEndOffset   int    `json:"selectionEndOffset"`
}

// List returns all active (non-expired) sessions for a project.
func (s *Sessions) List(projectID string) ([]Session, error) {
	cutoff := time.Now().Add(-s.opts.StaleTimeout)
	all, err := s.store.ListProjectSessions(projectID)
	if err != nil {
		return nil, err
	}
	active := make([]Session, 0, len(all))
	for _, ses := range all {
		if ses.LastActivityAt.After(cutoff) {
			active = append(active, ses)
		}
	}
	if active == nil {
		active = []Session{}
	}
	return active, nil
}

// Stop terminates the consumer and sweeper goroutines.
func (s *Sessions) Stop() {
	s.once.Do(func() {
		close(s.done)
		close(s.queue)
		<-s.stopped
	})
}

func (s *Sessions) consume() {
	defer func() { s.stopped <- struct{}{} }()
	for e := range s.queue {
		_ = s.store.BumpProjectSessionActivity(e.ProjectID, e.UserID, e.Timestamp)
	}
}

func (s *Sessions) sweep() {
	ticker := time.NewTicker(s.opts.SweepInterval)
	defer ticker.Stop()
	for {
		select {
		case <-s.done:
			return
		case <-ticker.C:
			_ = s.store.DeleteStaleProjectSessions(time.Now().Add(-s.opts.StaleTimeout))
		}
	}
}

// ErrSessionNotActive is returned when an operation targets a session that does
// not exist or has expired.
var ErrSessionNotActive = errors.New("no active session")

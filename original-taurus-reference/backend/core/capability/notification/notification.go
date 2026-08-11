// Package notification delivers ephemeral, per-user, Project-scoped toast
// notifications. A toast is a transient signal ("your task finished"), not a
// durable record: it lives in a bounded in-memory queue until its recipient
// drains it. A process restart may drop undelivered toasts by design — nothing
// downstream treats a toast as a source of truth. Producers are task workers;
// consumers are the caller draining GET /notifications for the selected Project.
package notification

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
	"sync"
	"time"
)

// Level is the closed severity vocabulary a client uses to style a toast.
type Level string

const (
	LevelInfo    Level = "info"
	LevelSuccess Level = "success"
	LevelWarning Level = "warning"
	LevelError   Level = "error"
)

const (
	// maxPerUser bounds each recipient's undrained queue within one Project so a
	// user who never polls cannot grow memory without limit; the oldest toast is
	// dropped first.
	maxPerUser = 100
	maxTitle   = 200
	maxBody    = 2000
)

// Toast is one ephemeral message addressed to a single user in one Project. ID
// and CreatedAt are assigned by Push; callers supply only Level, Title, Body and
// ProjectID.
type Toast struct {
	ID        string    `json:"id"`
	Level     Level     `json:"level"`
	Title     string    `json:"title"`
	Body      string    `json:"body,omitempty"`
	ProjectID string    `json:"projectId,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// queueKey routes a toast to one user's queue within one Project. A user who
// belongs to several Projects keeps a separate queue per Project, so draining
// the selected Project never delivers another Project's toasts.
type queueKey struct {
	projectID string
	userID    string
}

// Notifications is a bounded in-memory fan-in of per-user, per-Project toast
// queues, safe for concurrent producers (task workers) and consumers (HTTP
// drains).
type Notifications struct {
	mu     sync.Mutex
	queues map[queueKey][]Toast
	now    func() time.Time
}

// New returns an empty in-memory notifier.
func New() *Notifications {
	return &Notifications{queues: map[queueKey][]Toast{}, now: time.Now}
}

// Push appends one toast to a user's Project queue, assigning its ID and
// CreatedAt, clamping oversized text, and defaulting an unknown level to info.
// An empty userID is ignored so a task with no known requester cannot
// accumulate undeliverable toasts. Pushing past the per-user bound drops the
// oldest toast.
func (n *Notifications) Push(userID string, toast Toast) {
	if strings.TrimSpace(userID) == "" {
		return
	}
	toast.ID = newID()
	toast.CreatedAt = n.now().UTC()
	toast.Title = clamp(toast.Title, maxTitle)
	toast.Body = clamp(toast.Body, maxBody)
	if !validLevel(toast.Level) {
		toast.Level = LevelInfo
	}
	key := queueKey{projectID: toast.ProjectID, userID: userID}
	n.mu.Lock()
	defer n.mu.Unlock()
	queue := append(n.queues[key], toast)
	if len(queue) > maxPerUser {
		queue = queue[len(queue)-maxPerUser:]
	}
	n.queues[key] = queue
}

// Drain returns and removes every toast queued for a user in one Project, oldest
// first. A user with no toasts gets an empty (non-nil) slice. Draining is
// destructive: a delivered toast is gone, matching the fire-and-forget contract.
func (n *Notifications) Drain(projectID, userID string) []Toast {
	key := queueKey{projectID: projectID, userID: userID}
	n.mu.Lock()
	defer n.mu.Unlock()
	queue := n.queues[key]
	delete(n.queues, key)
	if queue == nil {
		return []Toast{}
	}
	return queue
}

func validLevel(level Level) bool {
	switch level {
	case LevelInfo, LevelSuccess, LevelWarning, LevelError:
		return true
	default:
		return false
	}
}

func clamp(text string, max int) string {
	if len(text) <= max {
		return text
	}
	// Trim on a rune boundary so a multibyte character is never cut in half.
	trimmed := text[:max]
	for len(trimmed) > 0 && !isRuneStart(trimmed[len(trimmed)-1]) {
		trimmed = trimmed[:len(trimmed)-1]
	}
	return trimmed
}

// isRuneStart reports whether b is not a UTF-8 continuation byte (0b10xxxxxx).
func isRuneStart(b byte) bool { return b&0xC0 != 0x80 }

func newID() string {
	buf := make([]byte, 16)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}

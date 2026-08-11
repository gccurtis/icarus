# presence.go

Presence capability: tracks which users currently have a document open. In-memory, ephemeral, and TTL-pruned — an entry lives only while its user keeps heartbeating, so an uncleanly closed browser expires instead of leaving a durable online record. Touch/Clear/Open, keyed per document. See repo conventions (AGENTS.md).

## Code breakdown

```go
// Package presence tracks which users currently have a document open. It is
// deliberately ephemeral and TTL-backed: an entry lives only while its user
// keeps heartbeating, so an uncleanly closed browser expires instead of leaving
// a durable "online" record. State is in-memory (lost on restart), which is the
// right durability for presence.
package presence

import (
	"sort"
	"sync"
	"time"
)

const (
	// DefaultTTL is how long a presence entry survives without a heartbeat.
	DefaultTTL = 30 * time.Second
	// MaxOpenUsers bounds one document's returned presence stack.
	MaxOpenUsers = 20
)

// Entry is one user's presence on a document.
type Entry struct {
	UserID string
	Name   string
	Access string
	SeenAt time.Time
}

// Presence is an in-memory, TTL-pruned presence tracker keyed by document.
type Presence struct {
	mu    sync.Mutex
	ttl   time.Duration
	now   func() time.Time
	byDoc map[string]map[string]Entry // documentID -> userID -> Entry
}

// New constructs a presence tracker with the given heartbeat TTL (DefaultTTL
// when non-positive).
func New(ttl time.Duration) *Presence {
	if ttl <= 0 {
		ttl = DefaultTTL
	}
	return &Presence{ttl: ttl, now: time.Now, byDoc: make(map[string]map[string]Entry)}
}

// Touch records or refreshes a user's presence on a document.
func (p *Presence) Touch(documentID, userID, name, access string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	doc := p.byDoc[documentID]
	if doc == nil {
		doc = make(map[string]Entry)
		p.byDoc[documentID] = doc
	}
	doc[userID] = Entry{UserID: userID, Name: name, Access: access, SeenAt: p.now()}
}

// Clear removes a user's presence from a document (idempotent).
func (p *Presence) Clear(documentID, userID string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if doc := p.byDoc[documentID]; doc != nil {
		delete(doc, userID)
		if len(doc) == 0 {
			delete(p.byDoc, documentID)
		}
	}
}

// Open returns the users currently present on a document — those whose last
// heartbeat is within the TTL — newest-seen first and bounded to MaxOpenUsers.
// Stale entries are pruned as a side effect.
func (p *Presence) Open(documentID string) []Entry {
	p.mu.Lock()
	defer p.mu.Unlock()
	doc := p.byDoc[documentID]
	if doc == nil {
		return nil
	}
	cutoff := p.now().Add(-p.ttl)
	live := make([]Entry, 0, len(doc))
	for id, e := range doc {
		if e.SeenAt.Before(cutoff) {
			delete(doc, id)
			continue
		}
		live = append(live, e)
	}
	if len(doc) == 0 {
		delete(p.byDoc, documentID)
	}
	sort.Slice(live, func(i, j int) bool {
		if !live[i].SeenAt.Equal(live[j].SeenAt) {
			return live[i].SeenAt.After(live[j].SeenAt)
		}
		return live[i].UserID < live[j].UserID
	})
	if len(live) > MaxOpenUsers {
		live = live[:MaxOpenUsers]
	}
	return live
}
```

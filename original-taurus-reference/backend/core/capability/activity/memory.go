package activity

import (
	"sync"
	"time"
)

// MemoryStore is a deterministic Activity read store for tests and in-memory
// composition. Initial events are copied and subsequent reads return copies.
type MemoryStore struct {
	mu     sync.RWMutex
	events []Event
}

func NewMemoryStore(events ...Event) *MemoryStore {
	copyEvents := append([]Event(nil), events...)
	Sort(copyEvents)
	return &MemoryStore{events: copyEvents}
}

func (s *MemoryStore) ListActivity(projectID, targetID string, before *Boundary, limit int) ([]Event, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Event, 0, limit)
	for _, event := range s.events {
		if event.ProjectID != projectID || (before != nil && !Before(event, *before)) {
			continue
		}
		if targetID != "" && event.Target.ID != targetID {
			continue
		}
		out = append(out, event)
		if len(out) == limit {
			break
		}
	}
	return out, nil
}

func (s *MemoryStore) LatestActivityByProjects(projectIDs []string) (map[string]time.Time, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	wanted := make(map[string]struct{}, len(projectIDs))
	for _, id := range projectIDs {
		wanted[id] = struct{}{}
	}
	out := make(map[string]time.Time)
	for _, event := range s.events {
		if _, ok := wanted[event.ProjectID]; !ok {
			continue
		}
		if current, ok := out[event.ProjectID]; !ok || event.OccurredAt.After(current) {
			out[event.ProjectID] = event.OccurredAt
		}
	}
	return out, nil
}

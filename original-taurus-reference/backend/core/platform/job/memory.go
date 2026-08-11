package job

import (
	"sort"
	"sync"
	"time"
)

// MemoryStore is an in-memory Store, used in tests. It is safe for concurrent
// use and mirrors the SQLite store's claim semantics.
type MemoryStore struct {
	mu   sync.Mutex
	jobs map[string]Job
}

// NewMemoryStore returns an empty in-memory job store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{jobs: make(map[string]Job)}
}

func (s *MemoryStore) Enqueue(j Job) (Job, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.jobs[j.ID] = j
	return j, nil
}

// ClaimDue picks the earliest-due queued job, marks it running, and increments
// its attempts — the same atomic step the SQLite store performs in a transaction.
func (s *MemoryStore) ClaimDue(now time.Time) (Job, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var pick *Job
	for id := range s.jobs {
		j := s.jobs[id]
		if j.Status != StatusQueued || j.RunAt.After(now) {
			continue
		}
		if pick == nil || j.RunAt.Before(pick.RunAt) {
			c := j
			pick = &c
		}
	}
	if pick == nil {
		return Job{}, false, nil
	}
	pick.Status = StatusRunning
	pick.Attempts++
	pick.UpdatedAt = now
	s.jobs[pick.ID] = *pick
	return *pick, true, nil
}

func (s *MemoryStore) Complete(id string) error {
	return s.update(id, func(j *Job) { j.Status = StatusDone })
}

func (s *MemoryStore) Retry(id, lastErr string, runAt time.Time) error {
	return s.update(id, func(j *Job) {
		j.Status = StatusQueued
		j.LastError = lastErr
		j.RunAt = runAt
	})
}

func (s *MemoryStore) Fail(id, lastErr string) error {
	return s.update(id, func(j *Job) {
		j.Status = StatusFailed
		j.LastError = lastErr
	})
}

func (s *MemoryStore) JobByID(id string) (Job, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	j, ok := s.jobs[id]
	if !ok {
		return Job{}, ErrNotFound
	}
	return j, nil
}

// JobsByStatus lists jobs newest-first for the observability read, filtered by
// status (empty means any) and bounded by the shared page cap — the same
// contract the SQLite store implements in SQL.
func (s *MemoryStore) JobsByStatus(status Status, limit int) ([]Job, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Job
	for _, j := range s.jobs {
		if status == "" || j.Status == status {
			out = append(out, j)
		}
	}
	// Newest first; the id breaks ties so the order is stable across map walks.
	sort.Slice(out, func(a, b int) bool {
		if out[a].CreatedAt.Equal(out[b].CreatedAt) {
			return out[a].ID > out[b].ID
		}
		return out[a].CreatedAt.After(out[b].CreatedAt)
	})
	if n := ClampJobsPage(limit); len(out) > n {
		out = out[:n]
	}
	return out, nil
}

// JobCounts tallies the jobs in each status, the summary side of the same
// observability read.
func (s *MemoryStore) JobCounts() (map[Status]int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	counts := make(map[Status]int)
	for _, j := range s.jobs {
		counts[j.Status]++
	}
	return counts, nil
}

// ReapStale requeues running jobs last touched before the given time, keeping
// their attempt count — the same recovery the SQLite store performs.
func (s *MemoryStore) ReapStale(before time.Time) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	n := 0
	for id, j := range s.jobs {
		if j.Status == StatusRunning && j.UpdatedAt.Before(before) {
			j.Status = StatusQueued
			j.RunAt = before
			j.UpdatedAt = before
			s.jobs[id] = j
			n++
		}
	}
	return n, nil
}

func (s *MemoryStore) update(id string, fn func(*Job)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	j, ok := s.jobs[id]
	if !ok {
		return ErrNotFound
	}
	fn(&j)
	s.jobs[id] = j
	return nil
}

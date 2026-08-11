package workspace

import "sync"

// MemoryStore is an in-memory Store for tests and single-process runs.
type MemoryStore struct {
	mu sync.Mutex
	m  map[string]Workspace
}

// NewMemoryStore constructs an empty in-memory store.
func NewMemoryStore() *MemoryStore { return &MemoryStore{m: make(map[string]Workspace)} }

func memoryKey(userID, projectID string) string { return userID + "\x00" + projectID }

// Workspace returns the stored workspace for (user, project), or ErrNotFound.
func (s *MemoryStore) Workspace(userID, projectID string) (Workspace, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	w, ok := s.m[memoryKey(userID, projectID)]
	if !ok {
		return Workspace{}, ErrNotFound
	}
	return w, nil
}

// SetWorkspace stores a workspace, replacing any prior value for its key.
func (s *MemoryStore) SetWorkspace(w Workspace) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.m[memoryKey(w.UserID, w.ProjectID)] = w
	return nil
}

var _ Store = (*MemoryStore)(nil)

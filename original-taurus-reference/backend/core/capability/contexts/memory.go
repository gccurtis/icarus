package contexts

import "sync"

// MemoryStore is an in-memory Store for tests and non-persistent runs.
type MemoryStore struct {
	mu    sync.Mutex
	byKey map[string]Context // key = projectID + "\x00" + id
}

// NewMemoryStore returns an empty store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{byKey: map[string]Context{}}
}

func contextKey(projectID, id string) string { return projectID + "\x00" + id }

// cloneRefs deep-copies a ref slice so callers can't mutate stored state
// through a returned/stored slice.
func cloneRefs(refs []Ref) []Ref {
	if refs == nil {
		return nil
	}
	out := make([]Ref, len(refs))
	copy(out, refs)
	return out
}

func cloneContext(c Context) Context {
	c.Includes = cloneRefs(c.Includes)
	c.Excludes = cloneRefs(c.Excludes)
	return c
}

func (m *MemoryStore) InsertContext(c Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.byKey[contextKey(c.ProjectID, c.ID)] = cloneContext(c)
	return nil
}

func (m *MemoryStore) ContextByID(projectID, id string) (Context, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.byKey[contextKey(projectID, id)]
	if !ok {
		return Context{}, ErrNotFound
	}
	return cloneContext(c), nil
}

func (m *MemoryStore) ContextSummaries(projectID string) ([]Context, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []Context
	for _, c := range m.byKey {
		if c.ProjectID == projectID {
			out = append(out, cloneContext(c))
		}
	}
	return out, nil
}

func (m *MemoryStore) UpdateContext(c Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.byKey[contextKey(c.ProjectID, c.ID)]; !ok {
		return ErrNotFound
	}
	m.byKey[contextKey(c.ProjectID, c.ID)] = cloneContext(c)
	return nil
}

func (m *MemoryStore) DeleteContext(projectID, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.byKey[contextKey(projectID, id)]; !ok {
		return ErrNotFound
	}
	delete(m.byKey, contextKey(projectID, id))
	return nil
}

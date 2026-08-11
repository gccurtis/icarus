package names

import "sync"

// MemoryStore is an in-memory NameStore, safe for concurrent use. It backs tests
// and the package until a durable store is wired.
type MemoryStore struct {
	mu       sync.Mutex
	projects map[string]map[string]Entry // project -> name -> entry
}

// NewMemoryStore returns an empty in-memory store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{projects: make(map[string]map[string]Entry)}
}

func (s *MemoryStore) PutName(project string, entry Entry) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	names, ok := s.projects[project]
	if !ok {
		names = make(map[string]Entry)
		s.projects[project] = names
	}
	names[entry.Name] = entry
	return nil
}

func (s *MemoryStore) Name(project, name string) (Entry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.projects[project][name]
	if !ok {
		return Entry{}, ErrNotFound
	}
	return cloneEntry(entry), nil
}

func (s *MemoryStore) Names(project string) ([]Entry, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Entry
	for _, entry := range s.projects[project] {
		out = append(out, cloneEntry(entry))
	}
	return out, nil
}

// cloneEntry returns a copy of entry whose Schema and Rows do not share
// backing storage with the original, so a caller may freely mutate the
// returned Entry without corrupting the store. Value is immutable and needs
// no copy.
func cloneEntry(entry Entry) Entry {
	entry.Schema = cloneColumns(entry.Schema)
	entry.Rows = cloneRows(entry.Rows)
	return entry
}

func (s *MemoryStore) DeleteName(project, name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.projects[project][name]; !ok {
		return ErrNotFound
	}
	delete(s.projects[project], name)
	return nil
}

// UpdateName runs the read, mutate, and write under a single lock, so
// concurrent callers mutating the same name are serialized and cannot lose an
// update. mutate sees a copy and the stored result is a copy, so neither aliases
// the store's data.
func (s *MemoryStore) UpdateName(project, name string, mutate func(Entry) (Entry, error)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.projects[project][name]
	if !ok {
		return ErrNotFound
	}
	updated, err := mutate(cloneEntry(entry))
	if err != nil {
		return err
	}
	s.projects[project][name] = cloneEntry(updated)
	return nil
}

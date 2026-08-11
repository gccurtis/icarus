package file

import (
	"sort"
	"sync"
)

// MemoryStore is an in-memory Store for tests and single-process runs. It holds
// each file's metadata and a copy of its bytes.
type MemoryStore struct {
	mu      sync.Mutex
	meta    map[string]File
	content map[string][]byte
	order   []string // file ids in insertion order
}

// NewMemoryStore returns an empty in-memory Store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{meta: map[string]File{}, content: map[string][]byte{}}
}

func (s *MemoryStore) Put(f File, content []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.meta[f.ID]; !exists {
		s.order = append(s.order, f.ID)
	}
	s.meta[f.ID] = f
	s.content[f.ID] = append([]byte(nil), content...)
	return nil
}

// Meta returns a file's metadata only to the project that owns it; a foreign
// project sees not-found, matching the SQL store's scoped WHERE clause.
func (s *MemoryStore) Meta(projectID, id string) (File, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	f, ok := s.meta[id]
	if !ok || f.ProjectID != projectID {
		return File{}, ErrNotFound
	}
	return f, nil
}

// Content returns a file's bytes only to the project that owns it. The label
// check happens here rather than in the caller, so unlabeled bytes never leave
// the store.
func (s *MemoryStore) Content(projectID, id string) ([]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if f, ok := s.meta[id]; !ok || f.ProjectID != projectID {
		return nil, ErrNotFound
	}
	c, ok := s.content[id]
	if !ok {
		return nil, ErrNotFound
	}
	return append([]byte(nil), c...), nil
}

func (s *MemoryStore) ByProject(projectID string) ([]File, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []File
	for _, id := range s.order {
		if f := s.meta[id]; f.ProjectID == projectID {
			out = append(out, f)
		}
	}
	// Newest first.
	sort.SliceStable(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out, nil
}

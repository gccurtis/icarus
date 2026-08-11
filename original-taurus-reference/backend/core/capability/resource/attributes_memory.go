package resource

import "sync"

// MemoryAttributeStore is an in-memory AttributeStore for tests and
// single-process runs.
type MemoryAttributeStore struct {
	mu   sync.Mutex
	byID map[string]map[AttributeKey]Attributes // projectID -> key -> attrs
}

// NewMemoryAttributeStore returns an empty in-memory AttributeStore.
func NewMemoryAttributeStore() *MemoryAttributeStore {
	return &MemoryAttributeStore{byID: map[string]map[AttributeKey]Attributes{}}
}

func (s *MemoryAttributeStore) ResourceAttributes(projectID string, kind Kind, id string) (Attributes, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.byID[projectID][AttributeKey{Kind: kind, ID: id}], nil
}

func (s *MemoryAttributeStore) SetResourceAttributes(projectID string, kind Kind, id string, attrs Attributes) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	proj := s.byID[projectID]
	if proj == nil {
		proj = map[AttributeKey]Attributes{}
		s.byID[projectID] = proj
	}
	key := AttributeKey{Kind: kind, ID: id}
	if attrs.IsZero() {
		delete(proj, key) // don't retain all-zero attributes
		return nil
	}
	proj[key] = attrs
	return nil
}

func (s *MemoryAttributeStore) ResourceAttributesByProject(projectID string) (map[AttributeKey]Attributes, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make(map[AttributeKey]Attributes, len(s.byID[projectID]))
	for k, v := range s.byID[projectID] {
		out[k] = v
	}
	return out, nil
}

package session

import (
	"sync"
	"time"
)

type MemoryStore struct {
	mu       sync.RWMutex
	sessions map[string]map[string]Session
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{sessions: make(map[string]map[string]Session)}
}

func (m *MemoryStore) UpsertProjectSession(s Session) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.sessions[s.ProjectID] == nil {
		m.sessions[s.ProjectID] = make(map[string]Session)
	}
	m.sessions[s.ProjectID][s.UserID] = s
	return nil
}

func (m *MemoryStore) CloseProjectSession(projectID, userID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.sessions[projectID] != nil {
		delete(m.sessions[projectID], userID)
	}
	return nil
}

func (m *MemoryStore) UpdateProjectSession(s Session) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	proj := m.sessions[s.ProjectID]
	if proj == nil {
		return nil
	}
	existing, ok := proj[s.UserID]
	if !ok {
		return nil
	}
	if s.CurrentDocumentID != "" {
		existing.CurrentDocumentID = s.CurrentDocumentID
	}
	if s.CaretAtomID != "" {
		existing.CaretAtomID = s.CaretAtomID
		existing.CaretOffset = s.CaretOffset
	} else {
		existing.CaretAtomID = ""
		existing.CaretOffset = 0
	}
	if s.SelectionStartAtomID != "" {
		existing.SelectionStartAtomID = s.SelectionStartAtomID
		existing.SelectionStartOffset = s.SelectionStartOffset
		existing.SelectionEndAtomID = s.SelectionEndAtomID
		existing.SelectionEndOffset = s.SelectionEndOffset
	} else {
		existing.SelectionStartAtomID = ""
		existing.SelectionStartOffset = 0
		existing.SelectionEndAtomID = ""
		existing.SelectionEndOffset = 0
	}
	existing.LastActivityAt = s.LastActivityAt
	proj[s.UserID] = existing
	return nil
}

func (m *MemoryStore) ListProjectSessions(projectID string) ([]Session, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	proj := m.sessions[projectID]
	if proj == nil {
		return nil, nil
	}
	result := make([]Session, 0, len(proj))
	for _, s := range proj {
		result = append(result, s)
	}
	return result, nil
}

func (m *MemoryStore) BumpProjectSessionActivity(projectID, userID string, t time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	proj := m.sessions[projectID]
	if proj == nil {
		return nil
	}
	if s, ok := proj[userID]; ok {
		s.LastActivityAt = t
		proj[userID] = s
	}
	return nil
}

func (m *MemoryStore) DeleteStaleProjectSessions(before time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for projID, proj := range m.sessions {
		for userID, s := range proj {
			if s.LastActivityAt.Before(before) {
				delete(proj, userID)
			}
		}
		if len(proj) == 0 {
			delete(m.sessions, projID)
		}
	}
	return nil
}

package connector

import (
	"sync"
	"time"
)

// MemoryStore is an in-memory Store for tests and non-persistent runs.
type MemoryStore struct {
	mu    sync.Mutex
	byKey map[string]Connector // key = projectID + "\x00" + id
	now   func() time.Time
}

// NewMemoryStore returns an empty store. now is unused today but kept for parity
// with persisted stores that stamp times.
func NewMemoryStore(now func() time.Time) *MemoryStore {
	return &MemoryStore{byKey: map[string]Connector{}, now: now}
}

func key(projectID, id string) string { return projectID + "\x00" + id }

func (m *MemoryStore) InsertConnector(c Connector) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.byKey[key(c.ProjectID, c.ID)] = c
	return nil
}

func (m *MemoryStore) ConnectorByID(projectID, id string) (Connector, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.byKey[key(projectID, id)]
	if !ok {
		return Connector{}, ErrNotFound
	}
	return c, nil
}

func (m *MemoryStore) ConnectorSummaries(projectID string) ([]Connector, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []Connector
	for _, c := range m.byKey {
		if c.ProjectID == projectID {
			out = append(out, c)
		}
	}
	return out, nil
}

func (m *MemoryStore) UpdateConnector(c Connector) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.byKey[key(c.ProjectID, c.ID)]; !ok {
		return ErrNotFound
	}
	m.byKey[key(c.ProjectID, c.ID)] = c
	return nil
}

func (m *MemoryStore) DeleteConnector(projectID, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.byKey[key(projectID, id)]; !ok {
		return ErrNotFound
	}
	delete(m.byKey, key(projectID, id))
	return nil
}

func (m *MemoryStore) AllConnectors() ([]Connector, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Connector, 0, len(m.byKey))
	for _, c := range m.byKey {
		out = append(out, c)
	}
	return out, nil
}

func (m *MemoryStore) SetConnectorSyncState(projectID, id, fingerprint string, seq int64, at time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.byKey[key(projectID, id)]
	if !ok {
		return ErrNotFound
	}
	c.Fingerprint = fingerprint
	c.SyncSeq = seq
	c.SyncedAt = at
	c.UpdatedAt = at
	// A sync that succeeded is not also mid-retry.
	c.FailedAttempts = 0
	c.LastError = ""
	c.RetryAfter = time.Time{}
	m.byKey[key(projectID, id)] = c
	return nil
}

func (m *MemoryStore) SetConnectorSyncFailure(projectID, id string, attempts int, lastErr string, retryAfter time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.byKey[key(projectID, id)]
	if !ok {
		return ErrNotFound
	}
	c.FailedAttempts = attempts
	c.LastError = lastErr
	c.RetryAfter = retryAfter
	m.byKey[key(projectID, id)] = c
	return nil
}

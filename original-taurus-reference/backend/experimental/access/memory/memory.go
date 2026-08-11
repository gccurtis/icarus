// Package memory is an in-memory implementation of the access storage
// interfaces, for use in tests. A single Store value implements every access
// store interface and is safe for concurrent use.
package memory

import (
	"sync"

	"github.com/gccurtis/taurus-omega/core/access"
)

// Store is an in-memory implementation of the access stores.
type Store struct {
	mu          sync.Mutex
	users       map[string]access.User    // by ID
	emails      map[string]string         // email -> user ID
	projects    map[string]access.Project // by ID
	memberships map[string]bool           // "userID\x00projectID" -> true
	sessions    map[string]access.Session // by ID
}

// New returns an empty in-memory store.
func New() *Store {
	return &Store{
		users:       make(map[string]access.User),
		emails:      make(map[string]string),
		projects:    make(map[string]access.Project),
		memberships: make(map[string]bool),
		sessions:    make(map[string]access.Session),
	}
}

// --- UserStore ---

func (s *Store) CreateUser(u access.User) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.users[u.ID] = u
	s.emails[u.Email] = u.ID
	return nil
}

func (s *Store) UserByID(id string) (access.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.users[id]
	if !ok {
		return access.User{}, access.ErrNotFound
	}
	return u, nil
}

func (s *Store) UserByEmail(email string) (access.User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	id, ok := s.emails[email]
	if !ok {
		return access.User{}, access.ErrNotFound
	}
	return s.users[id], nil
}

// --- ProjectStore ---

func (s *Store) CreateProject(p access.Project) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.projects[p.ID] = p
	return nil
}

func (s *Store) ProjectByID(id string) (access.Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[id]
	if !ok {
		return access.Project{}, access.ErrNotFound
	}
	return p, nil
}

func (s *Store) ProjectsByUser(userID string) ([]access.Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []access.Project
	for key := range s.memberships {
		uid, pid := splitKey(key)
		if uid == userID {
			if p, ok := s.projects[pid]; ok {
				out = append(out, p)
			}
		}
	}
	return out, nil
}

// --- MembershipStore ---

func (s *Store) AddMembership(m access.Membership) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.memberships[m.UserID+"\x00"+m.ProjectID] = true
	return nil
}

func (s *Store) IsMember(userID, projectID string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.memberships[userID+"\x00"+projectID], nil
}

// --- SessionStore ---

func (s *Store) CreateSession(sess access.Session) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[sess.ID] = sess
	return nil
}

func (s *Store) SessionByID(id string) (access.Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sess, ok := s.sessions[id]
	if !ok {
		return access.Session{}, access.ErrNotFound
	}
	return sess, nil
}

func (s *Store) UpdateSession(sess access.Session) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[sess.ID] = sess
	return nil
}

func (s *Store) DeleteSession(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, id)
	return nil
}

func splitKey(key string) (userID, projectID string) {
	for i := 0; i < len(key); i++ {
		if key[i] == 0 {
			return key[:i], key[i+1:]
		}
	}
	return key, ""
}

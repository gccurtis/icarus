package access

import (
	"sort"
	"sync"
)

// MemoryStore is an in-memory implementation of every access store interface
// (users, sessions, projects, memberships), used in tests. It is safe for
// concurrent use. A single value backs all of them, so the composition root
// passes it once per interface.
type MemoryStore struct {
	mu          sync.Mutex
	users       map[string]User        // by ID
	emails      map[string]string      // email -> user ID
	sessions    map[string]Session     // by ID
	projects    map[string]Project     // by ID
	memberships map[string]Membership  // by "userID\x00projectID"
	links       map[string]ProjectLink // by token
}

// NewMemoryStore returns an empty in-memory store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		users:       make(map[string]User),
		emails:      make(map[string]string),
		sessions:    make(map[string]Session),
		projects:    make(map[string]Project),
		memberships: make(map[string]Membership),
		links:       make(map[string]ProjectLink),
	}
}

// --- UserStore ---

func (s *MemoryStore) CreateUser(u User) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.users[u.ID] = u
	s.emails[u.Email] = u.ID
	return nil
}

func (s *MemoryStore) UserByID(id string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.users[id]
	if !ok {
		return User{}, ErrNotFound
	}
	return u, nil
}

func (s *MemoryStore) UserByEmail(email string) (User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	id, ok := s.emails[email]
	if !ok {
		return User{}, ErrNotFound
	}
	return s.users[id], nil
}

func (s *MemoryStore) UpdateUserName(id, name string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.users[id]
	if !ok {
		return ErrNotFound
	}
	u.Name = name
	s.users[id] = u
	return nil
}

func (s *MemoryStore) UpdateUserProfile(id, name, color, avatarURL string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.users[id]
	if !ok {
		return ErrNotFound
	}
	u.Name, u.Color, u.AvatarURL = name, color, avatarURL
	s.users[id] = u
	return nil
}

// --- SessionStore ---

func (s *MemoryStore) CreateSession(sess Session) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[sess.ID] = sess
	return nil
}

func (s *MemoryStore) SessionByID(id string) (Session, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sess, ok := s.sessions[id]
	if !ok {
		return Session{}, ErrNotFound
	}
	return sess, nil
}

func (s *MemoryStore) UpdateSession(sess Session) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[sess.ID] = sess
	return nil
}

func (s *MemoryStore) DeleteSession(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, id)
	return nil
}

// --- ProjectStore ---

func (s *MemoryStore) CreateProject(p Project) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.projects[p.ID] = p
	return nil
}

func (s *MemoryStore) ProjectByID(id string) (Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.projects[id]
	if !ok {
		return Project{}, ErrNotFound
	}
	return p, nil
}

func (s *MemoryStore) DeleteProject(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.projects, id)
	return nil
}

func (s *MemoryStore) UpdateProject(p Project) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.projects[p.ID]; !ok {
		return ErrNotFound
	}
	s.projects[p.ID] = p
	return nil
}

func (s *MemoryStore) ProjectsForUser(userID string) ([]ProjectMembership, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []ProjectMembership
	for _, m := range s.memberships {
		if m.UserID != userID {
			continue
		}
		if p, ok := s.projects[m.ProjectID]; ok {
			out = append(out, ProjectMembership{Project: p, Role: m.Role})
		}
	}
	return out, nil
}

// --- MembershipStore ---

func (s *MemoryStore) AddMembership(m Membership) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.memberships[membershipKey(m.UserID, m.ProjectID)] = m
	return nil
}

func (s *MemoryStore) Membership(userID, projectID string) (Membership, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	m, ok := s.memberships[membershipKey(userID, projectID)]
	if !ok {
		return Membership{}, ErrNotFound
	}
	return m, nil
}

func (s *MemoryStore) RemoveMembership(userID, projectID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.memberships, membershipKey(userID, projectID))
	return nil
}

func (s *MemoryStore) RemoveProjectMemberships(projectID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for k, m := range s.memberships {
		if m.ProjectID == projectID {
			delete(s.memberships, k)
		}
	}
	return nil
}

func (s *MemoryStore) MembersForProject(projectID string) ([]ProjectMember, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []ProjectMember
	for _, m := range s.memberships {
		if m.ProjectID != projectID {
			continue
		}
		if u, ok := s.users[m.UserID]; ok {
			out = append(out, ProjectMember{UserID: u.ID, Name: u.Name, Email: u.Email, Role: m.Role})
		}
	}
	return out, nil
}

func (s *MemoryStore) MembersSummaryByProjects(projectIDs []string, limit int) (map[string]ProjectMemberSummary, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	want := make(map[string]bool, len(projectIDs))
	for _, id := range projectIDs {
		want[id] = true
	}
	type row struct {
		email string
		sum   MemberSummary
	}
	byProject := map[string][]row{}
	for _, m := range s.memberships {
		if !want[m.ProjectID] {
			continue
		}
		if u, ok := s.users[m.UserID]; ok {
			byProject[m.ProjectID] = append(byProject[m.ProjectID], row{
				email: u.Email,
				sum:   MemberSummary{UserID: u.ID, Name: u.Name, AvatarURL: u.AvatarURL},
			})
		}
	}
	out := make(map[string]ProjectMemberSummary, len(projectIDs))
	for _, id := range projectIDs {
		rows := byProject[id]
		sort.Slice(rows, func(i, j int) bool { return rows[i].email < rows[j].email })
		summary := ProjectMemberSummary{Total: len(rows)}
		for i, r := range rows {
			if limit > 0 && i >= limit {
				break
			}
			summary.Items = append(summary.Items, r.sum)
		}
		out[id] = summary
	}
	return out, nil
}

// --- ProjectLinkStore ---

func (s *MemoryStore) PutProjectLink(l ProjectLink) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	// One link per (project, role): drop any existing link for this pair first.
	for token, existing := range s.links {
		if existing.ProjectID == l.ProjectID && existing.Role == l.Role {
			delete(s.links, token)
		}
	}
	s.links[l.Token] = l
	return nil
}

func (s *MemoryStore) ProjectLinkByToken(token string) (ProjectLink, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	l, ok := s.links[token]
	if !ok {
		return ProjectLink{}, ErrNotFound
	}
	return l, nil
}

func (s *MemoryStore) ProjectLinksForProject(projectID string) ([]ProjectLink, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []ProjectLink
	for _, l := range s.links {
		if l.ProjectID == projectID {
			out = append(out, l)
		}
	}
	return out, nil
}

func (s *MemoryStore) DeleteProjectLink(projectID string, role Role) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for token, l := range s.links {
		if l.ProjectID == projectID && l.Role == role {
			delete(s.links, token)
		}
	}
	return nil
}

func (s *MemoryStore) RemoveProjectLinks(projectID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for token, l := range s.links {
		if l.ProjectID == projectID {
			delete(s.links, token)
		}
	}
	return nil
}

func membershipKey(userID, projectID string) string { return userID + "\x00" + projectID }

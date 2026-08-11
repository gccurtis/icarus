package organization

import "sync"

// MemoryStore is an in-memory Store for focused tests. A production deployment
// uses the SQLite store; the semantics (an org is a row, a membership is a row
// keyed by org+user) are identical.
type MemoryStore struct {
	mu     sync.Mutex
	orgs   map[string]Organization
	member map[string]Membership // key: orgID + "\x00" + userID
}

// NewMemoryStore returns an empty in-memory Store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{orgs: map[string]Organization{}, member: map[string]Membership{}}
}

func memberKey(orgID, userID string) string { return orgID + "\x00" + userID }

func (s *MemoryStore) CreateOrganization(org Organization) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.orgs[org.ID]; exists {
		return ErrNotFound
	}
	s.orgs[org.ID] = org
	return nil
}

func (s *MemoryStore) OrganizationByID(id string) (Organization, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	org, ok := s.orgs[id]
	if !ok {
		return Organization{}, ErrNotFound
	}
	return org, nil
}

func (s *MemoryStore) UpdateOrganization(org Organization) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.orgs[org.ID]; !ok {
		return ErrNotFound
	}
	s.orgs[org.ID] = org
	return nil
}

func (s *MemoryStore) AddOrgMembership(m Membership) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.member[memberKey(m.OrgID, m.UserID)] = m
	return nil
}

func (s *MemoryStore) RemoveOrgMembership(orgID, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.member, memberKey(orgID, userID))
	return nil
}

func (s *MemoryStore) SetOrgMembershipRole(orgID, userID string, role Role) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	key := memberKey(orgID, userID)
	m, ok := s.member[key]
	if !ok {
		return ErrNotFound
	}
	m.Role = role
	s.member[key] = m
	return nil
}

func (s *MemoryStore) OrgMembershipsByUser(userID string) ([]Membership, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Membership
	for _, m := range s.member {
		if m.UserID == userID {
			out = append(out, m)
		}
	}
	return out, nil
}

func (s *MemoryStore) OrgMembershipsByOrg(orgID string) ([]Membership, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []Membership
	for _, m := range s.member {
		if m.OrgID == orgID {
			out = append(out, m)
		}
	}
	return out, nil
}

func (s *MemoryStore) OrgMembershipFor(orgID, userID string) (Membership, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	m, ok := s.member[memberKey(orgID, userID)]
	if !ok {
		return Membership{}, ErrNotFound
	}
	return m, nil
}

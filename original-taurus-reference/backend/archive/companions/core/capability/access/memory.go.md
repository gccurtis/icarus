# memory.go

`memory.go` provides `MemoryStore`, an in-memory implementation of *every* one of
the access layer's store interfaces — `UserStore`, `SessionStore`, `ProjectStore`,
and `MembershipStore`. It is the persistence backing tests run on: users,
sessions, projects, and memberships live in maps guarded by a single mutex, which
is enough to make the full password-login-and-projects surface usable without any
database.

A single `MemoryStore` value satisfies all five interfaces at once, so the
composition root constructs one and sets it in every field of the `Stores`
aggregate. That deliberate overlap keeps the wiring trivial while leaving the
interfaces free to be split apart later — a SQL-backed store implements the same
interfaces and drops in where this value sits without disturbing the others.

The implementation is intentionally plain: every method takes the mutex, does one
map operation (or a short scan), and returns. Correctness and concurrency-safety
are the only goals; there is no indexing beyond the email and membership keys, no
eviction, and no expiry logic here, because expiry is decided by the `Access`
service in `access.go` rather than the store.

## Code breakdown

### Package declaration and import

```go
package access

import (
	"sort"
	"sync"
)
```

The store lives in the same `access` package as the interfaces it implements, so
it needs no import of the domain types. Its one dependency is `sync`, for the
mutex that makes the maps safe under concurrent request handling.

### The MemoryStore type

```go
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
```

`MemoryStore` holds six maps behind one mutex. `users` is the primary user table
keyed by ID; `emails` is a secondary index mapping an email to its user ID, which
is what makes `UserByEmail` a lookup rather than a scan; `sessions` is the session
table keyed by ID; `projects` is the project table keyed by ID; `memberships` is
the join table keyed by a composite of user and project ID (the `membershipKey`
encoding, a NUL-separated pair defined at the end of this file); and `links` is the
project-invite-link table keyed by token, backing `ProjectLinkStore`. The comment
records the key architectural fact: one value implements all the interfaces and is
passed once per interface.

### The constructor

```go
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
```

`NewMemoryStore` initializes all six maps and returns the ready store. Doing the
allocation here means every method can assume the maps are non-nil and just read
or write them, with no lazy initialization anywhere.

### UserStore: create and look up

```go
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
```

These four methods implement `UserStore`. `CreateUser` writes the user into both
maps under the lock — the record into `users` by ID, and the email index into
`emails` — keeping the primary table and its index consistent in one critical
section; uniqueness of the email is enforced upstream in `Access.Register`, so
this method just stores what it is given. The two read methods return
`ErrNotFound` when the key is absent — the sentinel the service checks with
`errors.Is`. `UserByID` reads the primary map directly; `UserByEmail` does the
two-step lookup the email index enables: resolve the email to an ID, then return
the user under that ID. `UpdateUserName` reads the record, sets its `Name`, and
writes it back under the same lock — returning `ErrNotFound` for an id that isn't
present.

### SessionStore: create, read, update, delete

```go
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
```

The four `SessionStore` methods are the session-table analogues. `CreateSession`
stores a session by ID; `SessionByID` reads one and returns `ErrNotFound` when it
is absent. `UpdateSession` overwrites an existing session by ID — in a map that is
the same write as create, which is exactly what the service wants when it records
a project selection onto a live session. `DeleteSession` removes it and returns
`nil` unconditionally — deleting a missing key is a no-op in Go's map, which is
what makes `Access.Logout` idempotent. None of these methods consider expiry; the
`Access` service applies the expiry rule against the times it stamps on each
session, leaving the store a pure key-value backing.

### ProjectStore: create, read, delete, and list for a user

```go
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
```

These five methods implement `ProjectStore`. `CreateProject`, `ProjectByID`, and
`DeleteProject` mirror the session methods against the `projects` map — store by
ID, read with an `ErrNotFound` on a miss, and a no-op delete. `UpdateProject`
overwrites an existing project by ID with its mutated value, but — unlike the
session update — first checks the key is present, returning `ErrNotFound` if it
is not, so a rename or icon change against a vanished project fails cleanly.
`ProjectsForUser` is the join that the in-memory store performs by scanning: it
walks every membership, keeps those belonging to the user, and pairs each with its
project (skipping any membership whose project has since been deleted), returning a
`ProjectMembership` that carries both the project and the user's role in it. This
is the list a user's project picker is built from.

### MembershipStore: add, look up, and remove

```go
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
```

These five methods implement `MembershipStore`, all keyed by the composite
`membershipKey(userID, projectID)`. `AddMembership` stores (or overwrites) one
membership under that key, so re-adding a user to a project updates their role in
place. `Membership` reads one back and returns `ErrNotFound` when the pair has no
membership — this is the lookup `Access.Resolve` uses to confirm a user still
belongs to their selected project. `RemoveMembership` deletes a single pair (a
user leaving one project), while `RemoveProjectMemberships` scans the whole map to
remove every membership for a project at once — the cleanup that runs when a
project itself is deleted. `MembersForProject` is the reverse of
`ProjectsForUser`: it scans the memberships for one project and joins each to its
user in the `users` map (skipping any whose user is gone), returning the
`ProjectMember` rows the member-list endpoint and the owner-count checks consume.

### ProjectLinkStore: upsert, look up, list, and remove invite links

```go
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
```

These five methods implement `ProjectLinkStore`, the invite-link table keyed by
token. `PutProjectLink` enforces one link per `(project, role)` pair: it first
scans and deletes any existing link that matches the incoming link's project and
role, then stores the new one under its token — so regenerating a project's editor
link replaces the old one rather than leaving two live tokens for the same role.
`ProjectLinkByToken` resolves a token to its link, returning `ErrNotFound` on a
miss — the lookup that turns a follower's invite URL back into the project and role
it grants. `ProjectLinksForProject` scans the map and returns every link for one
project, the list the project's sharing settings display. `DeleteProjectLink`
removes the single link matching a `(project, role)` pair (revoking one invite),
while `RemoveProjectLinks` scans the whole map to drop every link for a project at
once — the cleanup that runs alongside `RemoveProjectMemberships` when a project is
deleted.

### The membership key helper

```go
func membershipKey(userID, projectID string) string { return userID + "\x00" + projectID }
```

`membershipKey` is the one-line encoder that turns a `(userID, projectID)` pair
into the single string that keys the `memberships` map. It joins the two IDs with
a NUL byte (`\x00`) — a separator that cannot appear in either hex-encoded ID — so
distinct pairs can never collide into the same key. Concentrating the encoding in
one function keeps every membership operation (add, look up, remove) in agreement
on the key format.

# memory.go

`memory.go` is the **in-memory** implementation of the access layer's storage
seams. It is the test-time counterpart to `access/sqlite`: a single `Store` type
that satisfies all four access store interfaces (`UserStore`, `ProjectStore`,
`MembershipStore`, and `SessionStore`), but backed by plain Go maps guarded by a
mutex rather than a database.

Its whole reason for existing is the persistence seam. Because the `Access`
service depends only on the store interfaces, tests can run the exact same access
logic against this fast, dependency-free fake — no SQLite file, no driver, no
migration — while production uses the durable backend. The two implementations are
deliberately interchangeable.

The code is intentionally simple: every method takes the lock, touches a map, and
returns. Records are stored by value, lookups return `access.ErrNotFound` when a
key is missing (matching the interface contract), and memberships are held in a
set keyed by a composite string. It is not built for durability or scale, only for
correctness under test.

## Code breakdown

### Package documentation and declaration

```go
// Package memory is an in-memory implementation of the access storage
// interfaces, for use in tests. A single Store value implements every access
// store interface and is safe for concurrent use.
package memory
```

The doc comment states the package's purpose plainly: an in-memory implementation
of the access storage interfaces, intended for tests, where one `Store` value
covers every interface and is safe for concurrent use.

### Imports

```go
import (
	"sync"

	"github.com/gccurtis/taurus-omega/core/access"
)
```

Just two imports: `sync` for the mutex that makes the store concurrency-safe, and
`access` for the domain types it stores and the `ErrNotFound` sentinel it returns.
Notably there is no database driver — the absence of any storage dependency is the
point of this implementation.

### The Store type

```go
// Store is an in-memory implementation of the access stores.
type Store struct {
	mu          sync.Mutex
	users       map[string]access.User    // by ID
	emails      map[string]string         // email -> user ID
	projects    map[string]access.Project // by ID
	memberships map[string]bool           // "userID\x00projectID" -> true
	sessions    map[string]access.Session // by ID
}
```

`Store` holds the entire dataset in maps, one per domain concern, all guarded by
the single `mu` mutex. `users` and `sessions` and `projects` are keyed by ID.
`emails` is a secondary index mapping a normalized email to its user ID, so
`UserByEmail` is a direct lookup rather than a scan. `memberships` is a set keyed
by the user and project IDs joined with a NUL byte — the same composite-key trick
the cell registry uses — with the bool value simply marking presence.

### Constructing a store

```go
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
```

`New` returns a ready, empty store with every map initialized. Tests call it to
get a fresh isolated dataset, and the returned `*Store` is dropped into an
`access.Stores` aggregate as all four store fields.

### UserStore: create and look up users

```go
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
```

This group implements `UserStore`. `CreateUser` writes the user into the primary
map and records its email in the secondary index in one locked step, so the two
stay consistent. `UserByID` is a direct map lookup that returns `access.ErrNotFound`
on a miss — the same contract the SQLite store honors. `UserByEmail` follows the
email index to a user ID and then returns that user, again yielding `ErrNotFound`
when the email is unknown.

### ProjectStore: create, look up, and list projects

```go
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
```

This group implements `ProjectStore`. `CreateProject` and `ProjectByID` are the
same store-and-fetch pattern as users, with the familiar `ErrNotFound` on a miss.
`ProjectsByUser` does in code what the SQLite store expresses as a join: it scans
every membership, decomposes each composite key with `splitKey`, and for keys
belonging to this user collects the corresponding project. Because it iterates a
map the result order is unspecified — acceptable for a test fake, and a visible
difference from the SQLite store's `ORDER BY created_at`.

### MembershipStore: link users to projects and test membership

```go
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
```

This group implements `MembershipStore`. `AddMembership` records the pairing by
setting its composite key to `true`; because a map assignment is idempotent,
re-adding an existing membership is naturally a no-op, matching the SQLite store's
`INSERT OR IGNORE`. `IsMember` simply reads the set — a missing key yields the map's
zero value `false`, so absence reads as "not a member" with no error, exactly as
the interface expects.

### SessionStore: create, read, update, and delete sessions

```go
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
```

This group implements `SessionStore`, the full session lifecycle. `CreateSession`
and `UpdateSession` are both a single keyed map write — for maps, insert and update
are the same operation, so `UpdateSession` transparently overwrites the stored
session (as `SelectProject` needs when attaching a project). `SessionByID` returns
the stored session or `ErrNotFound`, and `DeleteSession` removes the key, backing
logout and expired-session cleanup. Deleting an absent key is a harmless no-op,
which keeps logout idempotent.

### The key splitter

```go
func splitKey(key string) (userID, projectID string) {
	for i := 0; i < len(key); i++ {
		if key[i] == 0 {
			return key[:i], key[i+1:]
		}
	}
	return key, ""
}
```

`splitKey` is the inverse of the `userID + "\x00" + projectID` join used for
membership keys. It walks the string to the NUL byte and returns the two halves,
so `ProjectsByUser` can recover the user and project IDs from a composite key. If
no separator is found it returns the whole string as the user ID and an empty
project ID — a defensive fallback that should not occur for well-formed keys.

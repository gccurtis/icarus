# store.go

`store.go` defines the persistence seam of the access layer: a set of interfaces
that describe *what* the layer needs to store and retrieve, without saying *how*.
The Access service is written against these interfaces alone, which is what lets
the same service logic run unchanged against the real SQLite backend in production
and an in-memory fake in tests.

There is one interface per entity — users, projects, memberships, and sessions —
plus a `Stores` aggregate that bundles the four together as the service's single
persistence dependency. The interfaces are intentionally narrow, exposing only the
handful of operations the service actually performs. A shared contract runs across
all of them: a lookup that finds nothing returns `ErrNotFound` (defined in
`errors.go`), so callers handle a miss uniformly regardless of backend.

## Code breakdown

### Package declaration and the seam comment

```go
package access

// The store interfaces are the persistence seam. The Access service depends only
// on these, so the same logic runs against the SQLite implementation in
// production and an in-memory fake in tests. Each store returns ErrNotFound when
// a requested record does not exist.
```

The file opens with the package clause and a comment that frames everything below:
these interfaces are the seam between the service's logic and any concrete
storage. Because the service depends only on the interfaces, the backend is
swappable — SQLite in production, an in-memory fake in tests — and the comment
states the cross-cutting contract that every implementation must honor: return
`ErrNotFound` when a record is absent.

### The UserStore interface

```go
// UserStore persists users.
type UserStore interface {
	CreateUser(u User) error
	UserByID(id string) (User, error)
	UserByEmail(email string) (User, error)
}
```

`UserStore` covers the three user operations the service needs: create a user, and
look one up either by its ID or by its email. The two lookups mirror the two
entry points into the account — email at registration and sign-in, ID once a
session already names the user.

### The ProjectStore interface

```go
// ProjectStore persists projects.
type ProjectStore interface {
	CreateProject(p Project) error
	ProjectByID(id string) (Project, error)
	// ProjectsByUser returns every project the user is a member of.
	ProjectsByUser(userID string) ([]Project, error)
}
```

`ProjectStore` handles creating a project and fetching it by ID, plus
`ProjectsByUser`, which returns every project a user belongs to — the query behind
listing the projects a user may select. That last method is defined by membership,
not ownership, so it spans both the projects a user created and those they were
added to.

### The MembershipStore interface

```go
// MembershipStore persists the user↔project memberships that underpin project
// isolation.
type MembershipStore interface {
	AddMembership(m Membership) error
	IsMember(userID, projectID string) (bool, error)
}
```

`MembershipStore` is the persistence behind project isolation. It records a
membership and answers the isolation question directly: `IsMember` reports whether
a given user may access a given project, which is the check the service runs before
allowing a project to be selected or acted upon.

### The SessionStore interface

```go
// SessionStore persists sessions.
type SessionStore interface {
	CreateSession(s Session) error
	SessionByID(id string) (Session, error)
	UpdateSession(s Session) error
	DeleteSession(id string) error
}
```

`SessionStore` is the fullest of the four, exposing a complete lifecycle because a
session changes over time. `CreateSession` records a new sign-in, `SessionByID`
resolves the opaque cookie value back to a session, `UpdateSession` persists a
change — most notably attaching a `ProjectID` when the user selects a project — and
`DeleteSession` ends it on sign-out or expiry.

### The Stores aggregate

```go
// Stores aggregates the persistence dependencies the Access service needs. A
// single backend may implement all four interfaces.
type Stores struct {
	Users       UserStore
	Projects    ProjectStore
	Memberships MembershipStore
	Sessions    SessionStore
}
```

`Stores` bundles the four interfaces into one value, so the Access service takes a
single persistence dependency rather than four separate parameters. The comment
notes the practical reality that a single backend — the SQLite implementation, for
instance — commonly satisfies all four interfaces at once and is simply assigned
into each field.

package access

// The store interfaces are the persistence seam. The Access service depends only
// on these, so the same logic runs against the SQLite implementation in
// production and an in-memory fake in tests. Each store returns ErrNotFound when
// a requested record does not exist.

// UserStore persists users.
type UserStore interface {
	CreateUser(u User) error
	UserByID(id string) (User, error)
	UserByEmail(email string) (User, error)
}

// ProjectStore persists projects.
type ProjectStore interface {
	CreateProject(p Project) error
	ProjectByID(id string) (Project, error)
	// ProjectsByUser returns every project the user is a member of.
	ProjectsByUser(userID string) ([]Project, error)
}

// MembershipStore persists the user↔project memberships that underpin project
// isolation.
type MembershipStore interface {
	AddMembership(m Membership) error
	IsMember(userID, projectID string) (bool, error)
}

// SessionStore persists sessions.
type SessionStore interface {
	CreateSession(s Session) error
	SessionByID(id string) (Session, error)
	UpdateSession(s Session) error
	DeleteSession(id string) error
}

// Stores aggregates the persistence dependencies the Access service needs. A
// single backend may implement all four interfaces.
type Stores struct {
	Users       UserStore
	Projects    ProjectStore
	Memberships MembershipStore
	Sessions    SessionStore
}

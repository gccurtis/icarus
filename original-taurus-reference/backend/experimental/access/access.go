package access

import (
	"errors"
	"strings"
	"time"
)

// SessionCookieName is the cookie that carries the opaque session ID between
// requests. It is defined here because how a session is carried is part of the
// access contract; both the auth handlers (which set it) and the transport
// middleware (which reads it) refer to this name.
const SessionCookieName = "to_session"

// Access is the service that drives the access flow. It composes the storage
// stores, an Authenticator, and the runtime CellRegistry, and exposes the
// operations the transport layer needs: register, sign in and out, create and
// list projects, select a project, and resolve a session into a Context.
type Access struct {
	stores     Stores
	auth       Authenticator
	cells      *CellRegistry
	sessionTTL time.Duration

	now func() time.Time
}

// Options configure the Access service.
type Options struct {
	// SessionTTL is how long a new session remains valid. Defaults to 7 days.
	SessionTTL time.Duration
}

// New builds an Access service from its dependencies.
func New(stores Stores, auth Authenticator, cells *CellRegistry, opts Options) *Access {
	ttl := opts.SessionTTL
	if ttl <= 0 {
		ttl = 7 * 24 * time.Hour
	}
	return &Access{
		stores:     stores,
		auth:       auth,
		cells:      cells,
		sessionTTL: ttl,
		now:        time.Now,
	}
}

// Register creates a new user from email/password credentials. It validates the
// input, rejects an already-registered email, and stores the prepared secret.
func (a *Access) Register(creds Credentials) (User, error) {
	email := normalizeEmail(creds.Email)
	if !validEmail(email) {
		return User{}, ErrInvalidEmail
	}
	if len(creds.Password) < 8 {
		return User{}, ErrWeakPassword
	}

	if _, err := a.stores.Users.UserByEmail(email); err == nil {
		return User{}, ErrEmailTaken
	} else if !errors.Is(err, ErrNotFound) {
		return User{}, err
	}

	secret, err := a.auth.Prepare(Credentials{Email: email, Password: creds.Password})
	if err != nil {
		return User{}, err
	}

	u := User{ID: newID(), Email: email, PasswordHash: secret, CreatedAt: a.now().UTC()}
	if err := a.stores.Users.CreateUser(u); err != nil {
		return User{}, err
	}
	return u, nil
}

// Login verifies credentials and, on success, creates a session with no project
// selected yet. It returns ErrInvalidCredentials for both an unknown email and a
// wrong password, so it never reveals which accounts exist.
func (a *Access) Login(creds Credentials) (Session, error) {
	email := normalizeEmail(creds.Email)

	u, err := a.stores.Users.UserByEmail(email)
	if errors.Is(err, ErrNotFound) {
		return Session{}, ErrInvalidCredentials
	} else if err != nil {
		return Session{}, err
	}

	if err := a.auth.Verify(u.PasswordHash, Credentials{Email: email, Password: creds.Password}); err != nil {
		return Session{}, ErrInvalidCredentials
	}

	now := a.now().UTC()
	s := Session{
		ID:        newToken(),
		UserID:    u.ID,
		CreatedAt: now,
		ExpiresAt: now.Add(a.sessionTTL),
	}
	if err := a.stores.Sessions.CreateSession(s); err != nil {
		return Session{}, err
	}
	return s, nil
}

// Logout ends a session and discards its cell. A missing session is not an
// error — logout is idempotent.
func (a *Access) Logout(sessionID string) error {
	if s, err := a.stores.Sessions.SessionByID(sessionID); err == nil && s.ProjectID != "" {
		a.cells.Discard(s.UserID, s.ProjectID)
	}
	return a.stores.Sessions.DeleteSession(sessionID)
}

// Resolve turns a session ID into a Context. An unknown or expired session
// yields ErrNotFound (the caller treats that as anonymous). An expired session
// is deleted as a side effect.
func (a *Access) Resolve(sessionID string) (Context, error) {
	s, err := a.stores.Sessions.SessionByID(sessionID)
	if err != nil {
		return Context{}, err
	}
	if a.now().After(s.ExpiresAt) {
		_ = a.stores.Sessions.DeleteSession(s.ID)
		return Context{}, ErrNotFound
	}

	u, err := a.stores.Users.UserByID(s.UserID)
	if err != nil {
		return Context{}, err
	}

	ctx := Context{Session: &s, User: &u}
	if s.ProjectID != "" {
		if p, err := a.stores.Projects.ProjectByID(s.ProjectID); err == nil {
			ctx.Project = &p
			ctx.Cell = a.cells.Ensure(u.ID, p.ID)
		}
		// A project that has since disappeared is treated as "none selected".
	}
	return ctx, nil
}

// CreateProject creates a project owned by the user and makes the user a member.
func (a *Access) CreateProject(userID, name string) (Project, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return Project{}, ErrInvalidName
	}

	p := Project{ID: newID(), OwnerID: userID, Name: name, CreatedAt: a.now().UTC()}
	if err := a.stores.Projects.CreateProject(p); err != nil {
		return Project{}, err
	}
	if err := a.stores.Memberships.AddMembership(Membership{UserID: userID, ProjectID: p.ID}); err != nil {
		return Project{}, err
	}
	return p, nil
}

// ProjectsForUser lists the projects a user may access.
func (a *Access) ProjectsForUser(userID string) ([]Project, error) {
	return a.stores.Projects.ProjectsByUser(userID)
}

// SelectProject sets the session's active project (after checking membership)
// and ensures a cell exists for it. This is the step that produces the cell the
// rest of the endpoints use.
func (a *Access) SelectProject(sessionID, projectID string) (Session, error) {
	s, err := a.stores.Sessions.SessionByID(sessionID)
	if err != nil {
		return Session{}, err
	}

	member, err := a.stores.Memberships.IsMember(s.UserID, projectID)
	if err != nil {
		return Session{}, err
	}
	if !member {
		return Session{}, ErrForbidden
	}

	s.ProjectID = projectID
	if err := a.stores.Sessions.UpdateSession(s); err != nil {
		return Session{}, err
	}
	a.cells.Ensure(s.UserID, projectID)
	return s, nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// validEmail is a deliberately minimal check: a non-empty local part, an "@",
// and a non-empty domain with a dot. Full RFC validation is not the point here.
func validEmail(email string) bool {
	at := strings.IndexByte(email, '@')
	if at <= 0 || at == len(email)-1 {
		return false
	}
	domain := email[at+1:]
	return strings.Contains(domain, ".")
}

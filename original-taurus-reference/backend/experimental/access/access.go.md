# access.go

`access.go` defines the `Access` service — the orchestrator of the whole access
flow. It composes the persistence stores, an `Authenticator`, and the runtime
`CellRegistry`, and exposes the handful of operations the transport layer drives:
register a user, log in and out, create and list projects, select a project, and
resolve a session into a `Context`. Everything the earlier files declared — the
domain types, the store seams, the cells — comes together here.

The service is written entirely against interfaces and injectable dependencies:
the stores are the `Stores` interface set, authentication is the `Authenticator`
seam, and time comes from an overridable `now` function. As a result the same
logic runs against SQLite in production and an in-memory fake in tests, and
time-dependent behavior (session expiry) is testable. The methods encode the
access state machine: `Login` mints a session with no project, `SelectProject`
attaches a project after a membership check, and `Resolve` reads a session back
into as much of a `Context` as it has earned.

A recurring design intent throughout is careful handling of security-sensitive
edges: login returns the same error for an unknown email and a wrong password so
it never reveals which accounts exist; expired sessions are deleted on read;
logout is idempotent; and a project that has vanished degrades gracefully to
"none selected" rather than erroring.

## Code breakdown

### Package declaration and imports

```go
package access

import (
	"errors"
	"strings"
	"time"
)
```

The file is part of the `access` package. It imports `errors` for the
`errors.Is` comparisons that distinguish "not found" from real failures,
`strings` for email normalization and name trimming, and `time` for the session
TTL and timestamps.

### The session cookie name

```go
// SessionCookieName is the cookie that carries the opaque session ID between
// requests. It is defined here because how a session is carried is part of the
// access contract; both the auth handlers (which set it) and the transport
// middleware (which reads it) refer to this name.
const SessionCookieName = "to_session"
```

`SessionCookieName` is the single source of truth for the cookie that carries the
opaque session ID. It lives in the access package because the cookie is part of
the access contract shared by the two sides that touch it: the auth handlers that
set it after login and the transport middleware that reads it on each request.
Defining it once keeps those two in agreement.

### The Access service and its options

```go
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
```

`Access` holds the service's dependencies: the `stores` for persistence, the
`auth` seam for password preparation and verification, the `cells` registry for
runtime scopes, the `sessionTTL` that sets session lifetime, and an injectable
`now` clock. `Options` is the small configuration surface `New` accepts — for now
just `SessionTTL`, which defaults to seven days when left zero.

### Constructing the service

```go
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
```

`New` wires the service together from its injected dependencies and options. Its
only real logic is defaulting `SessionTTL` to seven days when the caller leaves it
unset (zero or negative), and installing the real `time.Now` as the clock. Taking
the stores, authenticator, and registry as parameters is what makes the service
composable and testable.

### Registering a user

```go
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
```

`Register` is the account-creation path. It normalizes and validates the email,
enforces a minimum password length, and then checks the email is not already
taken — where the `errors.Is(err, ErrNotFound)` distinction matters: a
`ErrNotFound` means the email is free (proceed), any other error is a real store
failure (propagate), and a nil error means the email exists (`ErrEmailTaken`). It
delegates password hashing to the authenticator's `Prepare`, then constructs the
`User` with a fresh ID and UTC timestamp and persists it. The plaintext password
never reaches storage — only the prepared secret does.

### Logging in

```go
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
```

`Login` verifies credentials and, on success, mints a new session. Its deliberate
security property is that both an unknown email and a wrong password return the
same `ErrInvalidCredentials`, so an attacker cannot use the error to learn which
emails are registered. On success it builds a `Session` with an opaque token ID,
the user's ID, and an expiry computed from `now` plus the configured TTL — and,
crucially, no `ProjectID`, because login lands the user in the "authenticated but
no project" state. The session is persisted before being returned so it can be
resolved on subsequent requests.

### Logging out

```go
// Logout ends a session and discards its cell. A missing session is not an
// error — logout is idempotent.
func (a *Access) Logout(sessionID string) error {
	if s, err := a.stores.Sessions.SessionByID(sessionID); err == nil && s.ProjectID != "" {
		a.cells.Discard(s.UserID, s.ProjectID)
	}
	return a.stores.Sessions.DeleteSession(sessionID)
}
```

`Logout` ends a session and releases the runtime scope it produced. It first looks
up the session and, if it exists and had a project selected, discards that
pairing's cell from the registry. Then it deletes the session record. The lookup
failing is ignored on purpose: logout is idempotent, so calling it on an already-
gone session is not an error — the delete simply has nothing to remove.

### Resolving a session into a Context

```go
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
```

`Resolve` is the read side of the flow: it turns a session ID (from the cookie)
into a `Context`, populating exactly as much as the session has earned. It loads
the session, and if it has expired it deletes it and returns `ErrNotFound` — the
caller treats that, like an unknown session, as anonymous. It then loads the user
to reach the authenticated state. If the session names a project, it loads the
project and ensures its cell, reaching the project-selected state. The graceful
touch is that a project which has since disappeared is silently treated as "none
selected" rather than failing the whole resolve. This is the method that builds
the `Context` the transport middleware hands to scoped handlers.

### Creating a project

```go
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
```

`CreateProject` creates a project and immediately makes its creator a member. It
trims and requires a non-empty name, builds the `Project` with a fresh ID and the
owner's user ID, persists it, and then adds a membership linking the user to the
new project. That membership is what later lets the user select and reach the
project — creating a project the creator couldn't access would be pointless, so
the two writes go together.

### Listing a user's projects

```go
// ProjectsForUser lists the projects a user may access.
func (a *Access) ProjectsForUser(userID string) ([]Project, error) {
	return a.stores.Projects.ProjectsByUser(userID)
}
```

`ProjectsForUser` is a thin pass-through to the project store's membership-aware
query, returning every project the user is a member of. It exists so the transport
layer talks only to the `Access` service, never to the stores directly.

### Selecting a project

```go
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
```

`SelectProject` is the transition into the project-selected state, and the step
that produces the cell endpoints run in. It loads the session, then enforces
project isolation by checking the user is a member of the target project —
returning `ErrForbidden` if not. Only then does it record the project on the
session (persisting the update) and ensure the pairing's cell exists in the
registry. After this, a subsequent `Resolve` of the same session will yield a
fully-populated `Context`.

### Email helpers

```go
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
```

These two unexported helpers back the email handling in `Register` and `Login`.
`normalizeEmail` lower-cases and trims so the same address always maps to one
account regardless of casing or stray whitespace. `validEmail` is an intentionally
minimal sanity check — a non-empty local part, an `@`, and a domain containing a
dot — with the comment making clear that full RFC-compliant validation is not the
goal; catching obviously malformed input is enough.

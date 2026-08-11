// Package access is the access layer: it establishes who is making a request — a
// User, identified by a single email — and lets the transport layer gate the
// rest of the application behind a valid session.
//
// A User is one email that may carry a password (bcrypt) and, later, linked OIDC
// identities. Password login only works if a password is set; an OIDC-only
// account has none (and can add one later). Registering and logging in are the
// only actions reachable without a user; everything else is gated by the
// transport layer, which resolves the session cookie into a User.
//
// Access state lives behind small store interfaces. Production wiring supplies
// one durable SQLite store for every port; memory.go supplies an isolated
// in-memory implementation for tests.
package access

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"

	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// SessionCookieName is the cookie that carries the opaque session ID. Both the
// password login path and (later) the OIDC callback converge on setting it, and
// the transport gate reads it.
const SessionCookieName = "to_session"

// CSRFCookieName is the cookie that carries the double-submit CSRF token. Unlike
// the session cookie it is deliberately NOT HttpOnly: the browser client has to
// read it and echo the value back in a request header, which is the whole point
// of the scheme. It carries no authority on its own — possession of the token
// proves nothing without the session cookie — so exposing it to scripts on our
// own origin costs nothing. The transport gate issues it; transport middleware
// checks it.
const CSRFCookieName = "to_csrf"

// NewCSRFToken mints a fresh CSRF token. It is the same unguessable random value
// the session and invite tokens use; the transport layer needs to mint one when
// a signed-in request arrives without a token cookie.
func NewCSRFToken() string { return newToken() }

// User is one account, identified by a single email. PasswordHash is empty for
// an account that has only ever used OIDC. Name is an optional display name.
type User struct {
	ID           string
	Email        string
	Name         string
	PasswordHash string
	CreatedAt    time.Time
	// Color and AvatarURL are per-user identity presentation. They live on the
	// User — the one identity that spans projects — not on any project membership.
	Color     string
	AvatarURL string
}

// PublicUser is the safe identity projection for a current Project peer. It
// never carries account, session, or provider data.
type PublicUser struct {
	ID          string    `json:"id"`
	Kind        string    `json:"kind"`
	Name        string    `json:"name"`
	Email       string    `json:"email,omitempty"`
	Role        string    `json:"role"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
	Color       string    `json:"color,omitempty"`
	AvatarURL   string    `json:"avatarUrl,omitempty"`
}

// HasPassword reports whether a password has been set for the account.
func (u User) HasPassword() bool { return u.PasswordHash != "" }

// Session is the record of a signed-in user, referenced by an opaque ID carried
// in a cookie. ProjectID is empty until the user selects a project.
type Session struct {
	ID        string
	UserID    string
	ProjectID string
	CreatedAt time.Time
	ExpiresAt time.Time
}

// Context is the resolved access state for a request: a session and its user,
// and — when the session has a selected project the user is still a member of —
// that project and the user's role in it. The transport gate produces the
// Context and hands it to scoped handlers, which scope their work to the project.
type Context struct {
	Session Session
	User    User
	Project *Project
	Role    Role
}

// HasProject reports whether a project is currently selected (and resolved).
func (c Context) HasProject() bool { return c.Project != nil }

// ScopedHandler is the handler shape for routes that require a signed-in user;
// it receives the resolved Context alongside the neutral request. Public routes
// use endpoint.Handler instead.
type ScopedHandler func(Context, endpoint.Request) endpoint.Response

// Sentinel errors returned by the stores and the service.
var (
	ErrNotFound           = errors.New("not found")
	ErrEmailTaken         = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrNoPassword         = errors.New("account has no password set")
	ErrInvalidEmail       = errors.New("email is not valid")
	ErrWeakPassword       = errors.New("password must be at least 8 characters")
	ErrForbidden          = errors.New("forbidden")
	ErrInvalidName        = errors.New("project name must not be empty")
	ErrInvalidIcon        = errors.New("project icon must be at most 64 characters")
	ErrInvalidPurpose     = errors.New("project purpose must be at most 1000 characters")
	ErrNoProjectChanges   = errors.New("project update must contain at least one field")
	ErrInvalidDisplayName = errors.New("display name must be at most 80 characters")
	ErrInvalidColor       = errors.New("color must be a hex color or a short token")
	ErrInvalidAvatar      = errors.New("avatar url is too long")
	ErrAlreadyMember      = errors.New("user is already a member")
	ErrInvalidRole        = errors.New("role must be owner, edit, or read")
	ErrLastOwner          = errors.New("a project must keep at least one owner")
	ErrInvalidVisibility  = errors.New("visibility must be private or link")
	ErrInvalidLinkRole    = errors.New("share-link role must be edit or read")
)

// UserStore persists users, keyed by id and unique email.
type UserStore interface {
	CreateUser(u User) error
	UserByID(id string) (User, error)
	UserByEmail(email string) (User, error)
	// UpdateUserName sets a user's display name. Returns ErrNotFound if absent.
	UpdateUserName(id, name string) error
	// UpdateUserProfile sets a user's display name, color, and avatar URL together.
	// Returns ErrNotFound if absent.
	UpdateUserProfile(id, name, color, avatarURL string) error
}

// SessionStore persists sessions.
type SessionStore interface {
	CreateSession(s Session) error
	SessionByID(id string) (Session, error)
	UpdateSession(s Session) error
	DeleteSession(id string) error
}

// Stores aggregates the persistence dependencies of the Access service. A single
// backend may implement all five interfaces.
type Stores struct {
	Users       UserStore
	Sessions    SessionStore
	Projects    ProjectStore
	Memberships MembershipStore
	Links       ProjectLinkStore
}

// Access establishes and resolves user identity, and manages projects and their
// memberships.
type Access struct {
	stores     Stores
	sessionTTL time.Duration
	now        func() time.Time
}

// Options configure the Access service.
type Options struct {
	// SessionTTL is how long a new session stays valid. Defaults to 7 days.
	SessionTTL time.Duration
}

// New builds an Access service over the given stores.
func New(stores Stores, opts Options) *Access {
	ttl := opts.SessionTTL
	if ttl <= 0 {
		ttl = 7 * 24 * time.Hour
	}
	return &Access{stores: stores, sessionTTL: ttl, now: time.Now}
}

// Register creates a password account for email — the "sign up" path. name is an
// optional display name (trimmed; may be empty).
func (a *Access) Register(email, password, name string) (User, error) {
	email = normalizeEmail(email)
	if !validEmail(email) {
		return User{}, ErrInvalidEmail
	}
	if len(password) < 8 {
		return User{}, ErrWeakPassword
	}
	name = strings.TrimSpace(name)
	if utf8.RuneCountInString(name) > 80 {
		return User{}, ErrInvalidDisplayName
	}

	if _, err := a.stores.Users.UserByEmail(email); err == nil {
		return User{}, ErrEmailTaken
	} else if !errors.Is(err, ErrNotFound) {
		return User{}, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, err
	}
	u := User{ID: newID(), Email: email, Name: name, PasswordHash: string(hash), CreatedAt: a.now().UTC()}
	if err := a.stores.Users.CreateUser(u); err != nil {
		return User{}, err
	}
	return u, nil
}

// SetUserName sets the caller's display name (trimmed; may be empty to clear). A
// name longer than 80 runes is rejected; an unknown user yields ErrNotFound.
func (a *Access) SetUserName(userID, name string) (User, error) {
	name = strings.TrimSpace(name)
	if utf8.RuneCountInString(name) > 80 {
		return User{}, ErrInvalidDisplayName
	}
	if err := a.stores.Users.UpdateUserName(userID, name); err != nil {
		return User{}, err
	}
	return a.stores.Users.UserByID(userID)
}

const maxAvatarURLLen = 512

// UpdateProfile applies a partial update to the caller's identity: any non-nil
// field is validated and set, a nil field is left unchanged. Name follows the
// same 80-rune rule as SetUserName; color must be a hex color or a short token
// (empty clears it); avatarUrl is a bounded string (the client derives it from an
// uploaded fileId). An unknown user yields ErrNotFound.
func (a *Access) UpdateProfile(userID string, name, color, avatarURL *string) (User, error) {
	u, err := a.stores.Users.UserByID(userID)
	if err != nil {
		return User{}, err
	}
	if name != nil {
		n := strings.TrimSpace(*name)
		if utf8.RuneCountInString(n) > 80 {
			return User{}, ErrInvalidDisplayName
		}
		u.Name = n
	}
	if color != nil {
		c := strings.TrimSpace(*color)
		if !validColor(c) {
			return User{}, ErrInvalidColor
		}
		u.Color = c
	}
	if avatarURL != nil {
		av := strings.TrimSpace(*avatarURL)
		if len(av) > maxAvatarURLLen || !validAvatarURL(av) {
			return User{}, ErrInvalidAvatar
		}
		u.AvatarURL = av
	}
	if err := a.stores.Users.UpdateUserProfile(u.ID, u.Name, u.Color, u.AvatarURL); err != nil {
		return User{}, err
	}
	return a.stores.Users.UserByID(userID)
}

// validAvatarURL accepts an empty value (clears the avatar), a same-origin
// relative path ("/files/…", the intended fileId-derived form), or an absolute
// https URL. It rejects every other scheme — javascript:, data:, http:, and the
// like — so a stored avatar can never become a script/URL injection when a client
// binds it to an href or src.
func validAvatarURL(av string) bool {
	if av == "" {
		return true
	}
	if strings.HasPrefix(av, "/") && !strings.HasPrefix(av, "//") {
		return true
	}
	return strings.HasPrefix(av, "https://") && len(av) > len("https://")
}

// validColor accepts an empty value (clears the color), a #rgb/#rrggbb hex color,
// or a short semantic token of letters, digits, and hyphens.
func validColor(c string) bool {
	if c == "" {
		return true
	}
	if c[0] == '#' {
		hex := c[1:]
		if len(hex) != 3 && len(hex) != 6 {
			return false
		}
		for _, r := range hex {
			if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')) {
				return false
			}
		}
		return true
	}
	if len(c) > 32 {
		return false
	}
	for _, r := range c {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-') {
			return false
		}
	}
	return true
}

// PublicUserInProject returns a target User's safe display projection only when
// that User is a current member of the supplied Project. The transport gate has
// already established the caller's membership in the selected Project.
func (a *Access) PublicUserInProject(projectID, userID string) (PublicUser, error) {
	membership, err := a.stores.Memberships.Membership(userID, projectID)
	if err != nil {
		return PublicUser{}, err
	}
	u, err := a.stores.Users.UserByID(userID)
	if err != nil {
		return PublicUser{}, err
	}
	return PublicUser{
		ID:          u.ID,
		Kind:        "person",
		Name:        u.Name,
		Email:       u.Email,
		Role:        string(membership.Role),
		Description: "A collaborator with access to this project.",
		CreatedAt:   u.CreatedAt,
		Color:       u.Color,
		AvatarURL:   u.AvatarURL,
	}, nil
}

// dummyHash is a valid bcrypt hash compared against on the login paths that have
// no real hash (unknown email, or an account with no password). It ensures those
// paths spend the same time hashing as a wrong-password attempt, so response
// timing does not reveal whether an account exists despite the uniform error.
var dummyHash = mustBcrypt("password-timing-equalizer")

func mustBcrypt(s string) []byte {
	h, err := bcrypt.GenerateFromPassword([]byte(s), bcrypt.DefaultCost)
	if err != nil {
		panic(err)
	}
	return h
}

// Login verifies an email/password and starts a session. An unknown email or a
// wrong password both return ErrInvalidCredentials (so neither reveals which
// accounts exist); an account with no password set returns ErrNoPassword.
func (a *Access) Login(email, password string) (Session, error) {
	email = normalizeEmail(email)

	u, err := a.stores.Users.UserByEmail(email)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return Session{}, err
	}

	// Always run a bcrypt comparison — against the real hash when we have one, or
	// a dummy otherwise — so an unknown email or a password-less account takes the
	// same time as a wrong password. Without this, response timing would reveal
	// whether an account exists even though the error message is identical.
	hash := dummyHash
	if err == nil && u.HasPassword() {
		hash = []byte(u.PasswordHash)
	}
	match := bcrypt.CompareHashAndPassword(hash, []byte(password)) == nil

	switch {
	case errors.Is(err, ErrNotFound):
		return Session{}, ErrInvalidCredentials
	case !u.HasPassword():
		return Session{}, ErrNoPassword
	case !match:
		return Session{}, ErrInvalidCredentials
	}
	return a.startSession(u)
}

// startSession creates and stores a new session for the user. This is the
// convergence point every authentication path — password today, OIDC later —
// ends at.
func (a *Access) startSession(u User) (Session, error) {
	now := a.now().UTC()
	s := Session{ID: newToken(), UserID: u.ID, CreatedAt: now, ExpiresAt: now.Add(a.sessionTTL)}
	if err := a.stores.Sessions.CreateSession(s); err != nil {
		return Session{}, err
	}
	return s, nil
}

// Logout ends a session. A missing session is not an error — logout is
// idempotent.
func (a *Access) Logout(sessionID string) error {
	return a.stores.Sessions.DeleteSession(sessionID)
}

// Resolve turns a session ID into its Context. Unknown or expired sessions yield
// ErrNotFound (the gate treats that as "no user"); an expired session is deleted
// as a side effect.
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

	ctx := Context{Session: s, User: u}
	if s.ProjectID != "" {
		// Populate the project and role only if the project still exists and the
		// user is still a member — a deleted project or a departed membership
		// simply leaves the session with none selected.
		if p, err := a.stores.Projects.ProjectByID(s.ProjectID); err == nil {
			if m, err := a.stores.Memberships.Membership(u.ID, s.ProjectID); err == nil {
				ctx.Project = &p
				ctx.Role = m.Role
			}
		}
	}
	return ctx, nil
}

func newID() string    { return randomHex(16) }
func newToken() string { return randomHex(32) }

func randomHex(n int) string {
	b := make([]byte, n)
	// crypto/rand.Read never returns an error on the platforms we target.
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// validEmail is a deliberately minimal check: a non-empty local part, an "@",
// and a domain containing a dot.
func validEmail(email string) bool {
	at := strings.IndexByte(email, '@')
	if at <= 0 || at == len(email)-1 {
		return false
	}
	return strings.Contains(email[at+1:], ".")
}

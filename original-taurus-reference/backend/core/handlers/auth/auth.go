// Package auth implements the sign-in application endpoints: registering an
// account and logging in run without a session (they are how a user first
// appears); logging out and reporting the current user run within a resolved
// access Context.
package auth

import (
	"errors"
	"net/http"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)

// Handlers holds the auth endpoints, bound to the Access service they drive.
type Handlers struct {
	access *access.Access
}

// NewHandlers builds the auth endpoints.
func NewHandlers(a *access.Access) Handlers { return Handlers{access: a} }

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}

// Register creates a new password account. Public (no session required).
func (h Handlers) Register(req endpoint.Request) endpoint.Response {
	var in credentials
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}

	u, err := h.access.Register(in.Email, in.Password, in.Name)
	switch {
	case errors.Is(err, access.ErrEmailTaken):
		return errResp(http.StatusConflict, "email already registered")
	case errors.Is(err, access.ErrInvalidEmail), errors.Is(err, access.ErrWeakPassword), errors.Is(err, access.ErrInvalidDisplayName):
		return errResp(http.StatusBadRequest, err.Error())
	case err != nil:
		return endpoint.Fail(http.StatusInternalServerError, "could not register", err)
	}
	return endpoint.Response{Status: http.StatusCreated, Body: userView(u)}
}

// Login verifies credentials and starts a session, returning the session cookie.
// Public. Every failure — unknown email, wrong password, or an account with no
// password set — returns the same error, so a caller cannot enumerate accounts.
func (h Handlers) Login(req endpoint.Request) endpoint.Response {
	var in credentials
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}

	sess, err := h.access.Login(in.Email, in.Password)
	switch {
	case errors.Is(err, access.ErrInvalidCredentials), errors.Is(err, access.ErrNoPassword):
		// Both cases return the same message so a caller cannot tell whether an
		// account exists (or exists but is OIDC-only) — no account enumeration.
		return errResp(http.StatusUnauthorized, "invalid email or password")
	case err != nil:
		return endpoint.Fail(http.StatusInternalServerError, "could not sign in", err)
	}
	return endpoint.Response{
		Status:    http.StatusOK,
		Body:      map[string]string{"status": "signed in"},
		SetCookie: sessionCookie(sess.ID, int(time.Until(sess.ExpiresAt).Seconds())),
	}
}

// Logout ends the current session and clears the cookie. Requires a session.
func (h Handlers) Logout(ctx access.Context, _ endpoint.Request) endpoint.Response {
	_ = h.access.Logout(ctx.Session.ID)
	return endpoint.Response{
		Status:    http.StatusOK,
		Body:      map[string]string{"status": "signed out"},
		SetCookie: sessionCookie("", -1),
	}
}

// Me reports the currently signed-in user. Requires a session.
func (h Handlers) Me(ctx access.Context, _ endpoint.Request) endpoint.Response {
	return endpoint.Response{Status: http.StatusOK, Body: userView(ctx.User)}
}

// UpdateName applies a partial update to the current user's profile — display
// name, color, and/or avatar URL. Any omitted field is left unchanged. Requires a
// session.
func (h Handlers) UpdateName(ctx access.Context, req endpoint.Request) endpoint.Response {
	var in struct {
		Name      *string `json:"name"`
		Color     *string `json:"color"`
		AvatarURL *string `json:"avatarUrl"`
	}
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}
	u, err := h.access.UpdateProfile(ctx.User.ID, in.Name, in.Color, in.AvatarURL)
	switch {
	case errors.Is(err, access.ErrInvalidDisplayName), errors.Is(err, access.ErrInvalidColor), errors.Is(err, access.ErrInvalidAvatar):
		return errResp(http.StatusBadRequest, err.Error())
	case err != nil:
		return endpoint.Fail(http.StatusInternalServerError, "could not update profile", err)
	}
	return endpoint.Response{Status: http.StatusOK, Body: userView(u)}
}

func sessionCookie(value string, maxAge int) *endpoint.Cookie {
	return &endpoint.Cookie{
		Name:     access.SessionCookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HTTPOnly: true,
		// The core always serves HTTPS, so the session cookie is always Secure
		// (HTTPS-only) as well as HttpOnly (not readable by scripts). Lax lets it
		// ride top-level navigations (e.g. a future OIDC redirect back to us)
		// while still blocking cross-site POST CSRF.
		Secure:   true,
		SameSite: endpoint.SameSiteLax,
	}
}

type userJSON struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	Color     string `json:"color,omitempty"`
	AvatarURL string `json:"avatarUrl,omitempty"`
}

func userView(u access.User) userJSON {
	return userJSON{ID: u.ID, Email: u.Email, Name: u.Name, Color: u.Color, AvatarURL: u.AvatarURL}
}

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
}

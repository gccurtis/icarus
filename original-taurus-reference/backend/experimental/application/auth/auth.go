// Package auth implements the sign-in application endpoints: registering an
// account, logging in and out, and reporting the current user. These are the
// entry points to the access flow — register and login run without a session;
// logout and me run within a resolved access Context.
package auth

import (
	"errors"
	"net/http"
	"time"

	"github.com/gccurtis/taurus-omega/core/access"
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
}

// Register creates a new account. It is a public endpoint (no session required).
func (h Handlers) Register(req endpoint.Request) endpoint.Response {
	var in credentials
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}

	u, err := h.access.Register(access.Credentials{Email: in.Email, Password: in.Password})
	switch {
	case errors.Is(err, access.ErrEmailTaken):
		return errResp(http.StatusConflict, "email already registered")
	case errors.Is(err, access.ErrInvalidEmail), errors.Is(err, access.ErrWeakPassword):
		return errResp(http.StatusBadRequest, err.Error())
	case err != nil:
		return errResp(http.StatusInternalServerError, "could not register")
	}
	return endpoint.Response{Status: http.StatusCreated, Body: userView(u)}
}

// Login verifies credentials and starts a session, returning the session cookie.
// It is a public endpoint.
func (h Handlers) Login(req endpoint.Request) endpoint.Response {
	var in credentials
	if err := req.Bind(&in); err != nil {
		return errResp(http.StatusBadRequest, "invalid JSON body")
	}

	sess, err := h.access.Login(access.Credentials{Email: in.Email, Password: in.Password})
	if err != nil {
		return errResp(http.StatusUnauthorized, "invalid email or password")
	}
	return endpoint.Response{
		Status:    http.StatusOK,
		Body:      map[string]string{"status": "signed in"},
		SetCookie: sessionCookie(sess.ID, int(time.Until(sess.ExpiresAt).Seconds())),
	}
}

// Logout ends the current session and clears the cookie. It requires a session.
func (h Handlers) Logout(ctx access.Context, _ endpoint.Request) endpoint.Response {
	_ = h.access.Logout(ctx.Session.ID)
	return endpoint.Response{
		Status:    http.StatusOK,
		Body:      map[string]string{"status": "signed out"},
		SetCookie: sessionCookie("", -1),
	}
}

// Me reports the currently signed-in user. It requires a session.
func (h Handlers) Me(ctx access.Context, _ endpoint.Request) endpoint.Response {
	return endpoint.Response{Status: http.StatusOK, Body: userView(*ctx.User)}
}

func sessionCookie(value string, maxAge int) *endpoint.Cookie {
	return &endpoint.Cookie{
		Name:     access.SessionCookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HTTPOnly: true,
	}
}

type userJSON struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func userView(u access.User) userJSON { return userJSON{ID: u.ID, Email: u.Email} }

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
}

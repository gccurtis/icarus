# auth.go

`auth.go` is the **application** layer's sign-in surface: the handlers for
registering an account, logging in, logging out, and reporting the current user.
Together they are the front door to the access flow — the sequence a session
moves through from anonymous, to signed-in, to project-selected.

Like every application-layer file it is transport-agnostic. It depends only on
the neutral `endpoint` contract and the `access` service, never on Echo. Two of
its handlers — `Register` and `Login` — are plain `endpoint.Handler`s that run
with no session at all, because they are how a session comes into existence.
The other two — `Logout` and `Me` — are `access.ScopedHandler`s: they take an
already-resolved `access.Context`, because they only make sense for a request
that carries a valid session. The gate middleware in the transport layer is what
decides which requests reach the scoped handlers; here the two shapes simply
declare each endpoint's requirement.

The handlers themselves are thin: they decode input, drive the `access` service,
and translate its typed errors into HTTP status codes. All state and rules live
in `access`; this file's job is the mapping between a request and that service,
plus rendering users and setting the session cookie.

## Code breakdown

### Package documentation and declaration

```go
// Package auth implements the sign-in application endpoints: registering an
// account, logging in and out, and reporting the current user. These are the
// entry points to the access flow — register and login run without a session;
// logout and me run within a resolved access Context.
package auth
```

The doc comment names the four endpoints and, importantly, splits them by access
stage: register and login run without a session, while logout and me run within
a resolved `access.Context`. That split is the organizing idea of the whole file
and is reflected in the two different handler signatures below.

### Imports

```go
import (
	"errors"
	"net/http"
	"time"

	"github.com/gccurtis/taurus-omega/core/access"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)
```

`errors` is used with `errors.Is` to distinguish the typed errors the `access`
service returns, `net/http` supplies the status-code constants, and `time`
computes the session cookie's lifetime. The two internal imports are the whole
application-layer contract: `access` is the service being driven, and `endpoint`
is the neutral request/response types. Notably neither is Echo — the transport
is nowhere in sight.

### The Handlers struct and its constructor

```go
// Handlers holds the auth endpoints, bound to the Access service they drive.
type Handlers struct {
	access *access.Access
}

// NewHandlers builds the auth endpoints.
func NewHandlers(a *access.Access) Handlers { return Handlers{access: a} }
```

`Handlers` binds the endpoints to the one dependency they share, the `access`
service. Making the endpoints methods on this struct is how they get at that
service without package-level state; `NewHandlers` is the trivial constructor the
composition layer calls to wire the service in. The value is returned by value —
it is just a pointer holder — and each endpoint hangs off it as a method.

### The credentials input

```go
type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}
```

`credentials` is the JSON shape both `Register` and `Login` accept. It is an
unexported, endpoint-local input type: the request is decoded into it and then
translated into the `access.Credentials` the service actually understands. Keeping
the wire shape separate from the service type means the API's JSON contract and
the service's internal type can evolve independently.

### Register

```go
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
```

`Register` creates an account and is one of the two public endpoints — its plain
`endpoint.Handler` signature (`Request` in, `Response` out, no context) is what
marks it as needing no session. It binds the body into `credentials`, replying
`400` if that fails, then hands the credentials to `access.Register`. The `switch`
is the heart of the handler: it maps each typed error the service can return to
the right status — a taken email is `409 Conflict`, a malformed email or weak
password is `400` (echoing the service's own message), and anything else is a
generic `500`. On success it returns `201 Created` with the new user rendered by
`userView`.

### Login

```go
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
```

`Login` is the other public endpoint and the point at which a session is born. It
binds the same `credentials`, then calls `access.Login`. Any failure collapses to
a single `401` with a deliberately vague message — login intentionally does not
reveal whether it was the email or the password that was wrong. On success the
session is returned to the client as a cookie: the response carries a `SetCookie`
built by `sessionCookie`, with a `MaxAge` computed from how long remains until the
session expires. From here the request has advanced from anonymous to
authenticated.

### Logout

```go
// Logout ends the current session and clears the cookie. It requires a session.
func (h Handlers) Logout(ctx access.Context, _ endpoint.Request) endpoint.Response {
	_ = h.access.Logout(ctx.Session.ID)
	return endpoint.Response{
		Status:    http.StatusOK,
		Body:      map[string]string{"status": "signed out"},
		SetCookie: sessionCookie("", -1),
	}
}
```

`Logout` ends the session and is the first of the two scoped handlers: its
`access.Context` parameter means the transport layer only invokes it once a valid
session has been resolved, so `ctx.Session` is guaranteed present. It tells the
service to invalidate that session — ignoring the error, since a failed logout
should still clear the client's cookie — and returns a cookie with an empty value
and `MaxAge` of `-1`, which instructs the browser to delete it. The request drops
back to anonymous.

### Me

```go
// Me reports the currently signed-in user. It requires a session.
func (h Handlers) Me(ctx access.Context, _ endpoint.Request) endpoint.Response {
	return endpoint.Response{Status: http.StatusOK, Body: userView(*ctx.User)}
}
```

`Me` reports who is signed in and is the second scoped handler. Because a resolved
context is a precondition of it being called, it can dereference `ctx.User`
without any nil check and simply render it with `userView`. It reads nothing from
the request body — the identity comes entirely from the session-resolved context.

### The session cookie builder

```go
func sessionCookie(value string, maxAge int) *endpoint.Cookie {
	return &endpoint.Cookie{
		Name:     access.SessionCookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HTTPOnly: true,
	}
}
```

`sessionCookie` centralizes how the session cookie is shaped so `Login` (setting
it) and `Logout` (clearing it) stay consistent. It uses the canonical
`access.SessionCookieName`, scopes the cookie to the whole site with `Path: "/"`,
and marks it `HTTPOnly` so client-side scripts cannot read the session value. The
caller varies only the value and `MaxAge`: a real session ID with a positive
lifetime to set it, or an empty value with a negative lifetime to delete it. It
returns the neutral `endpoint.Cookie`; the transport adapter is what turns that
into an actual HTTP cookie.

### Rendering a user and shared error helper

```go
type userJSON struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func userView(u access.User) userJSON { return userJSON{ID: u.ID, Email: u.Email} }

func errResp(status int, msg string) endpoint.Response {
	return endpoint.Response{Status: status, Body: map[string]string{"error": msg}}
}
```

`userJSON` and `userView` define the public JSON projection of a user, exposing
only the `ID` and `email` and deliberately leaving the password hash and other
internal fields off the wire. Routing every user response through `userView`
guarantees that projection is applied everywhere. `errResp` is the shared shape
for error responses — a `{"error": msg}` body with a status — used by every
failure path in the file so error replies stay uniform.

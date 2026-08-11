# auth.go

`auth.go` is the **application** layer's sign-in surface. It exposes the four
endpoints through which identity is established and inspected: `Register` and
`Login` create a user or a session and run without one, while `Logout` and `Me`
operate within an already-resolved session. Like every application endpoint, the
handlers are transport-agnostic — they speak only the neutral `endpoint`
contract and drive the `access` service, never touching Echo.

The file is a thin translation layer, and that thinness is the point. The real
identity logic lives in `access`; these handlers only decode the request, call
the matching service method, and map its result — including each sentinel error —
onto an HTTP status and a JSON body. The split between the two public
`endpoint.Handler` methods and the two `access.ScopedHandler` methods mirrors the
access layer's own distinction: the public pair take just a request, while the
scoped pair also receive the resolved `access.Context` that the transport gate
guarantees.

Login and logout are also where the session cookie is written. `Login` sets it
from the freshly minted session; `Logout` clears it by re-issuing the same cookie
with a negative max-age. Both go through one helper so the cookie's name, path,
and flags stay identical on the way in and out.

## Code breakdown

### Package documentation and declaration

```go
// Package auth implements the sign-in application endpoints: registering an
// account and logging in run without a session (they are how a user first
// appears); logging out and reporting the current user run within a resolved
// access Context.
package auth
```

The doc comment states the package's scope and the fundamental division among its
four endpoints: register and login are the pre-session entry points — the only
way a user first appears — while logout and "me" presuppose a resolved session.
That division is exactly what the two different handler signatures below encode.

### Imports

```go
import (
	"errors"
	"net/http"
	"time"

	"github.com/gccurtis/taurus-omega/core/capability/access"
	"github.com/gccurtis/taurus-omega/core/endpoint"
)
```

`errors` compares the access sentinels with `errors.Is`; `net/http` supplies the
status constants; `time` computes the cookie's max-age from the session expiry.
`access` is the service these handlers drive and the source of the `Context` and
sentinel errors; `endpoint` is the neutral request/response contract. As with
every application package, Echo is absent — the transport dependency stops at the
gate.

### The handler set and its constructor

```go
// Handlers holds the auth endpoints, bound to the Access service they drive.
type Handlers struct {
	access *access.Access
}

// NewHandlers builds the auth endpoints.
func NewHandlers(a *access.Access) Handlers { return Handlers{access: a} }
```

`Handlers` bundles the four endpoints around the one dependency they share, the
`*access.Access` service. Making it a struct with methods (rather than free
functions) is how the service is injected once and reused by every handler.
`NewHandlers` is the trivial constructor the composition root calls to bind them.

### The credentials input

```go
type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Name     string `json:"name"`
}
```

`credentials` is the JSON body shape shared by `Register` and `Login`: an email,
a password, and an optional display `name`. It is unexported because it is purely
an internal decoding target; the handlers bind into it and then pass its fields to
the service. `Login` simply ignores the `name` field.

### Register — create an account, publicly

```go
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
		return errResp(http.StatusInternalServerError, "could not register")
	}
	return endpoint.Response{Status: http.StatusCreated, Body: userView(u)}
}
```

`Register` is a public `endpoint.Handler` — it takes only a request. It binds the
credentials (now including the optional display `name`), calls `access.Register`,
and translates the outcome: a taken email becomes `409 Conflict`, the validation
errors (`ErrInvalidEmail`, `ErrWeakPassword`, and an over-long
`ErrInvalidDisplayName`) become `400` with the underlying message passed through,
any other error becomes a generic `500`, and success returns `201 Created` with
the sanitized user view. The error-to-status mapping is the whole job here; the
decision of *what* is an error belongs to the service.

### Login — authenticate and set the cookie

```go
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
		return errResp(http.StatusInternalServerError, "could not sign in")
	}
	return endpoint.Response{
		Status:    http.StatusOK,
		Body:      map[string]string{"status": "signed in"},
		SetCookie: sessionCookie(sess.ID, int(time.Until(sess.ExpiresAt).Seconds())),
	}
}
```

`Login` is also public. It binds credentials and calls `access.Login`, and its
error mapping is deliberately uniform: both `ErrInvalidCredentials` (wrong
password or no such account) and `ErrNoPassword` (the account exists but is
OIDC-only, with no password to check) return the *same* `401` with the identical
"invalid email or password" message. That sameness is the security property — a
caller cannot use the response to tell whether an email is registered, or whether
a registered account is OIDC-only, so there is no account enumeration. Any other
error collapses to a generic `500`. On success it returns `200` and, crucially,
attaches the session cookie via `SetCookie`, deriving the cookie's max-age from
the time remaining until the session expires. This is where a new session first
reaches the client.

### Logout — end the session and clear the cookie

```go
// Logout ends the current session and clears the cookie. Requires a session.
func (h Handlers) Logout(ctx access.Context, _ endpoint.Request) endpoint.Response {
	_ = h.access.Logout(ctx.Session.ID)
	return endpoint.Response{
		Status:    http.StatusOK,
		Body:      map[string]string{"status": "signed out"},
		SetCookie: sessionCookie("", -1),
	}
}
```

`Logout` is an `access.ScopedHandler`: its first parameter is the resolved
`access.Context`, so it knows which session to end without inspecting the request.
It deletes the session (ignoring the idempotent error) and clears the client's
cookie by re-issuing it empty with a max-age of `-1`, which instructs the browser
to delete it. The request itself is unused — the identity it needs already came
through the context from the gate.

### Me — report the current user

```go
// Me reports the currently signed-in user. Requires a session.
func (h Handlers) Me(ctx access.Context, _ endpoint.Request) endpoint.Response {
	return endpoint.Response{Status: http.StatusOK, Body: userView(ctx.User)}
}
```

`Me` is the simplest scoped handler: it just returns the user from the resolved
context as a sanitized view. It needs no service call at all, because the gate has
already resolved and validated the user — the endpoint's entire value is reading
back who the caller is.

### UpdateName — set the display name

```go
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
		return errResp(http.StatusInternalServerError, "could not update profile")
	}
	return endpoint.Response{Status: http.StatusOK, Body: userView(u)}
}
```

`UpdateName` backs `PATCH /auth/me`. It binds a one-field body, scopes the change
to the resolved user from the gate (never a user id from the request), and calls
`SetUserName`. An over-long name comes back as `ErrInvalidDisplayName` → `400` with
the message; any other failure is a generic `500`. On success it returns the
updated user through the same sanitized `userView` as `Me`, so the client can read
the new name straight from the response.

### The session cookie helper

```go
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
```

`sessionCookie` centralizes the cookie's shape so that setting it (login) and
clearing it (logout) produce identical cookies apart from value and max-age —
which matters, because a browser only replaces a cookie whose name and path
match. It uses the shared `access.SessionCookieName` and scopes the cookie to the
whole site, then hardens it: `HTTPOnly` keeps the session token out of reach of
client script, and `Secure` restricts it to HTTPS — set unconditionally now,
because the core always serves HTTPS. Its `SameSite` is `Lax`, which (as the
comment explains) lets the cookie ride top-level navigations — such as a future
OIDC redirect back to the app — while still blocking cross-site POST CSRF.

### The user view and error helpers

```go
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
```

`userJSON` and `userView` define the sanitized public projection of a user —
the ID, email, and display name, deliberately omitting the password hash and
timestamps so those never leak into a response. `errResp` builds the uniform error
body, `{"error": msg}`, with a status, giving every failure path in the file one
consistent shape.

### Failures carry their cause

Its 3 failure responses (`could not register`, and the rest)
go through `endpoint.Fail`, which attaches the error to
`Response.Err` for the request log while the body stays exactly as opaque as it was.
No response shape changed; what changed is that the reason is now recorded instead of
discarded.

See `core/endpoint/endpoint.go.md` for why that field sat unused, and why the
constructor lives there rather than beside each of the seventeen private `errResp`
copies. The `errResp` here remains for the failures that genuinely have no cause to
attach.

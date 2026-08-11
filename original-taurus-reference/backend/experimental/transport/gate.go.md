# gate.go

`gate.go` is the **transport** layer's enforcement point for the access flow. It
holds the middleware that turns a raw HTTP request's session cookie into a
resolved `access.Context` and then decides whether the request has reached the
access stage a route requires. Where the application handlers merely *declare*
what they need (a plain handler needs nothing; a scoped handler needs a context),
this file is where that requirement is actually checked and rejected requests are
turned away before any handler runs.

There are two gates. `requireAuth` admits only requests carrying a valid session —
it is the boundary that enforces "no routes until a user is resolved" for the
authenticated group. `requireProject` goes further: it admits only sessions that
have selected a project, and only when the `:projectID` in the URL matches that
selected project — this is where project isolation lives, ensuring a session can
reach only the one project it has selected. Both gates, on success, stash the
resolved `access.Context` onto the Echo context so the scoped adapter can later
hand it to the application handler.

The design keeps a clean seam between transport and application: the messy work of
reading cookies, resolving sessions, checking path parameters, and writing error
responses stays here in the transport layer, so the application handlers receive a
ready-made `access.Context` and never touch Echo. The gates are the guards; the
adapters (in `transport.go`) are the couriers.

## Code breakdown

### Package declaration and imports

```go
package transport

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/gccurtis/taurus-omega/core/access"
)
```

This file is part of the `transport` package. Its imports mark it clearly as
transport-layer code: `net/http` for status constants, `echo` for the middleware
and context types, and `access` for the service it calls and the `Context` type it
produces. Unlike the application handlers, transport code is allowed to know about
Echo — bridging Echo and the neutral contract is its whole job.

### The context key

```go
// ctxKey is the Echo-context key under which the resolved access.Context is
// stashed by the gate middleware for adaptScoped to read.
const ctxKey = "access.context"
```

`ctxKey` is the agreed-upon key that couples the two halves of the request path.
Each gate stores the resolved `access.Context` under this key on the Echo context,
and `adaptScoped` (in `transport.go`) reads it back out to pass to the scoped
handler. Defining it as a single constant here keeps the producer and consumer in
sync.

### Resolving the session

```go
// resolve reads the session cookie and turns it into an access.Context. A
// missing, invalid, or expired session yields the zero Context (anonymous).
func (s *server) resolve(c echo.Context) access.Context {
	cookie, err := c.Cookie(access.SessionCookieName)
	if err != nil || cookie == nil || cookie.Value == "" {
		return access.Context{}
	}
	ctx, err := s.access.Resolve(cookie.Value)
	if err != nil {
		return access.Context{}
	}
	return ctx
}
```

`resolve` is the shared first step of both gates: it converts a request's session
cookie into an `access.Context`. It reads the canonical session cookie, and if the
cookie is missing or empty it returns the zero `Context` — which is precisely the
anonymous state, with all fields nil. Otherwise it asks the `access` service to
resolve the cookie value into a full context; any resolution error (an unknown or
expired session) also collapses to the anonymous zero value. This means the gates
never have to distinguish the many ways a session can be absent — they just check
what stage the returned context represents.

### The authentication gate

```go
// requireAuth admits only requests that carry a valid session (a signed-in
// user), stashing the resolved context for the handler. This is the gate that
// enforces "no routes until the user object is set", except the public routes
// that are registered outside this group.
func (s *server) requireAuth(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx := s.resolve(c)
		if !ctx.Authenticated() {
			return c.JSON(http.StatusUnauthorized, errorBody("sign in required"))
		}
		c.Set(ctxKey, ctx)
		return next(c)
	}
}
```

`requireAuth` is the gate on the authenticated route group. Written in Echo's
standard middleware shape — a function wrapping the next handler — it resolves the
context and then checks `Authenticated()`. If no valid user is present it
short-circuits with `401` and a `"sign in required"` body, never calling the
wrapped handler. If a user is present it stores the resolved context under `ctxKey`
and proceeds. This is the enforcement behind "no routes until the user object is
set": every route in the authenticated group is guaranteed a signed-in user,
except the public routes, which are registered outside this group and so bypass
the gate entirely.

### The project-isolation gate

```go
// requireProject admits only requests from a session that has selected a project,
// and only when the :projectID in the path matches the selected project. This is
// where project isolation is enforced: a session may only reach the project it
// has selected.
func (s *server) requireProject(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx := s.resolve(c)
		if !ctx.Authenticated() {
			return c.JSON(http.StatusUnauthorized, errorBody("sign in required"))
		}
		if !ctx.HasProject() {
			return c.JSON(http.StatusConflict, errorBody("select a project first"))
		}
		if c.Param("projectID") != ctx.Project.ID {
			return c.JSON(http.StatusForbidden, errorBody("project not selected for this session"))
		}
		c.Set(ctxKey, ctx)
		return next(c)
	}
}
```

`requireProject` is the stricter gate on the project-scoped route group, and it
enforces three conditions in escalating order. First, like `requireAuth`, it
requires a signed-in user, rejecting with `401` otherwise. Second, it requires
that the session has actually selected a project — `HasProject()` checks that both
a project and a cell are resolved — and returns `409 Conflict` with "select a
project first" if not, signaling a request made out of order rather than one that
is forbidden. Third, and this is the isolation check, it compares the `:projectID`
in the URL path against the session's selected project ID; a mismatch is `403
Forbidden`. Only when all three hold does it stash the context and proceed. The
combined effect is that a session can reach exactly one project — the one it
selected — and cannot address any other by putting a different ID in the path.

### The error body helper

```go
func errorBody(msg string) map[string]string {
	return map[string]string{"error": msg}
}
```

`errorBody` builds the `{"error": msg}` map that every rejection in this file
returns as JSON. It mirrors the `errResp` helpers in the application packages so
that a gate rejection and an application-level error look identical on the wire —
the client cannot tell, and need not care, whether a `403` came from the gate or
from a handler.

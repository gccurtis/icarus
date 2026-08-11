# gate.go

`gate.go` is the **transport** layer's access gate: the Echo middleware that
enforces "you must be signed in" — and, for a project's own resources, "you must
have selected a project" — on every route that is not explicitly public. It is the
single place where the abstract rules from the access layer become concrete checks
against a real HTTP request.

The gate is the bridge between transport and access. It reads the session cookie
off the Echo request, hands the opaque value to the `access` service to resolve
into a full `access.Context`, and either rejects the request or stashes the
resolved context for a downstream scoped-handler adapter to pick up. This is why
the file lives in the transport package and depends on both Echo and `access`:
it is precisely the seam that translates a carried session into resolved identity.

Four small functions do the work. `resolve` is the "cookie → context or not"
step, deliberately reducing every failure mode to a single boolean so the caller
never has to distinguish "no cookie" from "expired session". `issueCSRF` is the
one thing it does besides resolving: hand a signed-in request the CSRF token it
will need on its next mutating call. `requireUser` and `requireProject` are the
two middlewares built on top of `resolve`: `requireUser` turns that boolean into
either a `401` or a call into the protected handler, while `requireProject` adds
a second gate that also demands a selected project (a `409` otherwise) before
letting a request reach a project-scoped resource.

## Code breakdown

### Package declaration and imports

```go
package transport

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/gccurtis/taurus-omega/core/capability/access"
)
```

The gate is part of the `transport` package, alongside the rest of the HTTP
wiring. `net/http` supplies the status constants for the rejections; `echo` is the
middleware and context machinery it plugs into; `access` is the service it calls
to resolve a session and the source of the `Context` it produces. The presence of
both `echo` and `access` here is what marks this file as the translation point
between the two layers.

### The context key

```go
// ctxKey is the Echo-context key under which the gate stashes the resolved
// access.Context for adaptScoped to read.
const ctxKey = "access.context"
```

`ctxKey` is the agreed-upon key under which the resolved `access.Context` is
stored on the Echo context. The gate writes it; the scoped-handler adapter
(`adaptScoped`) reads it. Naming it as a shared constant keeps those two sides in
agreement, so a request that passes the gate carries its identity forward to the
handler without re-resolving.

### resolve — cookie to context, as a boolean

`resolve` performs the actual lookup and collapses every "not signed in" case
into a single `false`. A missing, empty, or unreadable cookie short-circuits
before any service call; otherwise the cookie's value is handed to
`access.Resolve`, and any error from it — unknown session, expired session, a
vanished user — also becomes `false`. The caller therefore only sees "resolved to
this context" or "anonymous", which is exactly the distinction the gates need and
no more. It reads the cookie under the shared `access.SessionCookieName` so it
matches whatever `Login` set. Both `requireUser` and `requireProject` build on it.

It has exactly one side effect, on the success path only: a call to `issueCSRF`
before it returns. Putting it here rather than in each gate means every route
that requires identity — gated or project-scoped — also mints the CSRF token,
without either middleware having to remember to.

### issueCSRF — mint the double-submit token, once, where identity is proven

`issueCSRF` sets the `to_csrf` cookie on a signed-in request that does not
already carry a non-empty one; a request that already has a token is left
completely alone (which is also what the tests assert, so a token cannot silently
rotate under a client mid-flight).

Three decisions are worth stating:

- **Why the gate, not `Login`.** Issuing here means a session created *before*
  this defence existed heals itself on its next request, and it avoids touching
  the `endpoint.Response` contract, which carries at most one `SetCookie`.
- **Why not HttpOnly.** The client must read the value to echo it in the
  `X-CSRF-Token` header — that echo is the mechanism. Unlike the session cookie,
  the token is not a credential; it proves nothing without `to_session`.
- **Why no `MaxAge`.** It lasts the browser session. If it is dropped while the
  session cookie survives, the next request simply mints a new one here, so the
  cookie never needs an expiry policy of its own.

The value comes from `access.NewCSRFToken()`, the same `crypto/rand` token used
for sessions and invite links. `Path` is `/` and `SameSite` is `Lax`, matching
the session cookie so the two always travel together; `Secure` is set, as the
core always serves HTTPS. `middleware.go`'s `requireCSRF` is the other half —
this function hands out the token, that one insists on seeing it echoed back.

### requireUser — the sign-in gate

```go
// requireUser gates every non-public route. Without a session that resolves to a
// user, the only reachable endpoints are the public ones (health, register,
// login) — this is the "no user object → sign in / log in only" rule. On
// success it stashes the resolved context for the scoped handler.
func (s *server) requireUser(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx, ok := s.resolve(c)
		if !ok {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "sign in required"})
		}
		c.Set(ctxKey, ctx)
		return next(c)
	}
}
```

`requireUser` is the middleware in Echo's standard shape — a function wrapping the
next handler. For each request it calls `resolve`; if that reports anonymous, it
stops the request cold with a `401` and a "sign in required" body, never invoking
the wrapped handler. Only public routes, which are simply not wrapped in this
middleware, escape the check. On success it stores the resolved context under
`ctxKey` and proceeds to `next`, so the protected handler — via its adapter — can
read the identity the gate already established. This is the enforcement point for
the whole "no user, no access" rule.

### requireProject — the selected-project gate

```go
// requireProject gates the project-scoped routes (a project's resources, such as
// its documents). It requires a signed-in user who has also selected a project;
// the resolved context then carries that project, the user's role, and the cell.
func (s *server) requireProject(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		ctx, ok := s.resolve(c)
		if !ok {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "sign in required"})
		}
		if !ctx.HasProject() {
			return c.JSON(http.StatusConflict, map[string]string{"error": "select a project first"})
		}
		c.Set(ctxKey, ctx)
		return next(c)
	}
}
```

`requireProject` is the stricter gate for routes that act on a project's own
resources — the documents endpoints, for instance. It reuses `resolve` for the
same sign-in check, rejecting an anonymous request with the identical `401`, and
then adds a second condition: the resolved context must actually carry a selected
project, which `ctx.HasProject()` reports. A signed-in user who has not yet
selected one is turned away with a `409 Conflict` and a "select a project first"
body, distinguishing "you are not signed in" from "you are signed in but have not
chosen a project to work in". Only when both hold does it stash the context under
`ctxKey` and continue, so the scoped handler downstream can rely on the context
carrying a project, the user's role within it, and the cell. Routes wrap
themselves in this middleware (rather than `requireUser`) when they operate inside
a selected project.

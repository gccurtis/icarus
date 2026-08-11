# Fix inert session presence-activity middleware

The presence-activity middleware never fired (surfaced in
[0058](0058-documentation-alignment.md)). It was supposed to keep a user
"present" while they edit — bumping `LastActivityAt` on ordinary mutating
requests — so a working user is not swept as stale. Instead, presence only
advanced when the client explicitly called `POST /sessions` or
`PUT /sessions/current`.

**Root cause.** The middleware lived in the `session` capability and read the
request's access context with `c.Get("access.context").(accessContext)`, where
`accessContext` was a *local* struct declared in the session package. The
transport gate stores a concrete `access.Context` under that key. A Go type
assertion to a different named type always yields `ok == false`, so the middleware
returned early every time and never called `PushEvent`. The shim existed precisely
because a capability may not import another capability — the session package could
not name `access.Context` — but a structurally-identical local type can never
satisfy a nominal type assertion. The middleware was simply in the wrong layer.

**Fix.** Move the middleware into the transport layer, which already depends on
both `access` and `session`, so it can read the real `access.Context` and push the
event. The broken shim is deleted.

## `core/capability/session/session.go`

### Removed the misplaced `Middleware` and its `accessContext` shim

Deleted `func Middleware(...)` and the `accessContext` struct, and dropped the now
-unused `github.com/labstack/echo/v4` import. The session capability no longer
depends on an HTTP framework at all — it just exposes `PushEvent`/`Event`, which
transport now calls. This keeps the capability free of transport concerns, the
direction the layering intends.

## `core/transport/transport.go`

### Added `sessionActivity` and rewired the scoped group

`sessionActivity(*session.Sessions) echo.MiddlewareFunc` reads the resolved
`access.Context` the gate stashed under `ctxKey` and, on a successful (2xx)
`POST`/`PUT`/`DELETE`/`PATCH` within a selected project, pushes a `request` event
(`ProjectID`, `UserID`, `UserName` from `ctx.Project`/`ctx.User`) that the session
consumer turns into a `LastActivityAt` bump. The project-scoped group now installs
`sessionActivity(opts.Sessions)` in place of `session.Middleware(opts.Sessions)`.
Reading `access.Context` here is legitimate — transport is where the gate produces
it — so the fix respects the dependency rule rather than working around it.

## `core/transport/transport_test.go`

### Strengthened `TestSessionActivityMiddleware` to actually assert the bump

The prior test asserted only that `LastActivityAt` was **not before** `StartedAt`,
which is trivially true after `Start`, so it passed even though the middleware
never fired. It now captures the post-`Start` activity time, issues a mutating
request, and asserts `LastActivityAt` **advances past** that value. This fails
against the old code and passes against the fix, so the regression is guarded.

## Companion docs

Regenerated [`session.go.md`](../../core/capability/session/session.go.md) and
[`transport.go.md`](../../core/transport/transport.go.md) verbatim against the new
source.

## Why

Presence is only meaningful if it reflects real activity. With the middleware
inert, a user editing a document for more than the stale timeout would silently
drop out of the "who's here" list even while actively working, and the frontend
live-cursor/presence features would be unreliable. The move also removes a genuine
layering smell — a domain capability importing an HTTP framework and reaching into
transport's request context — so the code now matches the ports-and-adapters rule
the rest of the backend follows.

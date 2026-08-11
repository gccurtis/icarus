# experimental/

Parked reference code — **not built** as part of the application.

This directory holds the access/auth layer we prototyped in one pass (users,
projects, sessions, per-(user,project) cells, a bcrypt authenticator, a durable
SQLite store, and the transport gating that enforced the flow). We're rebuilding
that capability more incrementally in `core/`, so the prototype lives here as a
reference to draw from rather than as live code.

## Why it isn't built

`go build ./...` from the project root skips any directory with its own
`go.mod`, so the [`go.mod`](go.mod) here keeps this snapshot out of the build.
The `.go` files still import their original `github.com/gccurtis/taurus-omega/core/...`
paths, so they will **not** compile in this location — read them as a reference,
not a runnable module.

The fully-integrated, working version (these files wired into `core/`, all tests
and the `dev-test` access suite passing) is preserved in git at commit
**`b0fd447`** — check it out there to run it.

## What's here

- [`access/`](access/) — domain (users, projects, memberships, sessions), the
  `Access` service, a pluggable `Authenticator` (bcrypt `PasswordAuthenticator`,
  with OIDC intended as a second implementation), the runtime `Cell`/`CellRegistry`,
  storage interfaces, and both a `sqlite/` (durable) and `memory/` (test) store.
- [`application/auth/`](application/auth/) — register / login / logout / me.
- [`application/project/`](application/project/) — list / create / select / whoami.
- [`transport/gate.go`](transport/gate.go) — the session-resolution and gating
  middleware (`requireAuth`, `requireProject`) that enforced the
  anonymous → authenticated → project-selected state machine and project isolation.
- [`dev-test/`](dev-test/) — the end-to-end access suite (register → login →
  create/select project → cell-scoped route) plus a copy of the cookie-jar
  `lib.sh` it needs.

Each `.go` file keeps its paired `.go.md` companion doc.

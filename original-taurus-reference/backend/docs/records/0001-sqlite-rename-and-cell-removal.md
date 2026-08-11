# 0001 — Move the SQLite store to core/storage; remove the unused cell

Two cleanups after documents landed as the first project-scoped resource:

1. The SQLite store had grown to back every domain (the access stores *and*
   documents), so its home under `core/access/sqlite` was misleading. It moves to
   a neutral `core/storage/sqlite`.
2. The `Cell` / `CellRegistry` were a speculative per-(user, project) runtime
   object from the early design, but **nothing ever read a cell**: project
   scoping comes entirely from the selected project in the request context
   (`ctx.Project.ID` + role + membership). With no per-project runtime state to
   hold, the cell was dead weight and is removed. A runtime object can return
   later — named for whatever it actually holds — when real per-project state
   appears.

## core/storage/sqlite/sqlite.go  (moved from core/access/sqlite)

### Relocated the durable store to a neutral storage package

Moved with `git mv core/access/sqlite core/storage/sqlite` (the package name
stays `sqlite`). Its doc comment, which still described an access-only store, now
states its real role:

```go
// Package sqlite is the durable, SQLite-backed store for the whole application.
// It uses the pure-Go modernc.org/sqlite driver, so it builds with plain
// `go build` (no cgo). A single Store value implements every persistence
// interface — the access stores (users, sessions, projects, memberships) and the
// document store — so one connection, and one file, backs all of them and every
// resource survives a restart.
package sqlite
```

**Why:** the same `*Store` already implements the access interfaces *and*
`document.Store`. Keeping it under `core/access` implied it was access-specific
and forced `core/access/sqlite` to import `core/document`, which read backwards.
A neutral `core/storage` home matches what it is — the one place durable state
lives — and is where future resource stores will go too.

## core/composition/composition.go

### Import the store from its new path and drop the cell registry

```go
	acc := access.New(
		access.Stores{Users: store, Sessions: store, Projects: store, Memberships: store},
		access.Options{SessionTTL: ttl},
	)
```

The import changed from `core/access/sqlite` to `core/storage/sqlite`, and the
`access.New(...)` call no longer passes an `access.NewCellRegistry()`. The
adjacent comment was corrected to note the one store backs every resource, not
just users and sessions.

**Why:** composition is the only place that constructs these objects, so both the
removed cell registry and the store's new path surface here.

## core/access/access.go

### Remove the cell from the resolved Context

```go
type Context struct {
	Session Session
	User    User
	Project *Project
	Role    Role
}
```

`Context` no longer carries a `Cell`. **What/why:** scoped handlers already scope
their work to `ctx.Project.ID` with `ctx.Role`; the cell field was never read, so
it is dropped.

### Drop the cell registry from the Access service and its constructor

```go
type Access struct {
	stores     Stores
	sessionTTL time.Duration
	now        func() time.Time
}

// New builds an Access service over the given stores.
func New(stores Stores, opts Options) *Access {
	ttl := opts.SessionTTL
	if ttl <= 0 {
		ttl = 7 * 24 * time.Hour
	}
	return &Access{stores: stores, sessionTTL: ttl, now: time.Now}
}
```

**What/why:** `Access` no longer holds a `*CellRegistry`, and `New` drops the
`cells` parameter — with no cells, there is nothing for a registry to manage, and
the service is now purely stores plus session settings.

### Stop touching cells in Logout and Resolve

`Logout` reverts to simply deleting the session (it previously discarded the
session's cell). `Resolve` still populates `Project` and `Role` for a selected
project, but no longer builds a cell:

```go
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
```

**Why:** these were the only places that created or discarded cells; with the
cell gone, that bookkeeping goes too, leaving project/role resolution intact.

## core/access/project.go

### Remove cell bookkeeping from SelectProject, DeleteProject, and LeaveProject

Selecting a project now just records it on the session; deleting or leaving a
project no longer discards cells. For example, `SelectProject`:

```go
	s.ProjectID = projectID
	if err := a.stores.Sessions.UpdateSession(s); err != nil {
		return Session{}, err
	}
	return s, nil
```

**Why:** the `Ensure` / `Discard` / `DiscardProject` calls existed only to keep
the cell registry in sync; none is needed now. The behavior a caller sees —
select sets the active project, delete/leave remove membership — is unchanged.

## core/access/memory.go

### Rename the membership-key helper (cellKey → membershipKey)

The in-memory store keyed its memberships map with `cellKey`, a helper that lived
in the now-deleted `cell.go`. It gains its own, aptly named helper:

```go
func membershipKey(userID, projectID string) string { return userID + "\x00" + projectID }
```

**Why:** the function was shared only by coincidence (cells and memberships both
key on user+project). With `cell.go` gone, the store owns the small helper it
needs.

## core/access/cell.go  (removed)

### Deleted the Cell type and CellRegistry

The whole file — `Cell`, `CellRegistry`, `Ensure` / `Discard` / `DiscardProject`,
and `cellKey` — was removed, along with its paired `cell.go.md`.

**Why:** nothing read a cell, so the entire abstraction was removed rather than
carried as dead code. See the summary at the top for the fuller reasoning.

---

## Follow-up: shorten the default session TTL to 24h

The default session lifetime was `168h` (7 days), an arbitrary "stay logged in
for a week" value from the early scaffold. With no refresh or sliding expiry, the
session cookie lives that entire time, so a stolen cookie stays valid for a week.
Shortened to `24h`. (Longer sessions can return later via sliding/refresh expiry.)
The change records also moved from `records/` to `docs/records/`.

### core/config/config.go — default session TTL is now 24h

```go
		Access:  Access{SessionTTL: "24h"},
```

`Default()` hands out a 24-hour lifetime instead of a week (the `Access.SessionTTL`
field-comment example was updated to `"24h"` to match). This is the value used
when a manifest omits `access.session_ttl`, so the safer default belongs here.

### etc/config.yaml — manifest session_ttl lowered to 24h

```yaml
access:
  # How long a session stays valid, as a Go duration string (e.g. "24h" = 1 day).
  session_ttl: "24h"
```

The checked-in dev manifest matches the new code default, so running with or
without a manifest behaves the same.

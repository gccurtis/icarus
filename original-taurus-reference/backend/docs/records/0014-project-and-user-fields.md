# 0014 — Project & user fields (rename, icon, timestamps, display name)

The Taurus Alpha cockpit tracks a set of **backend requests** against Omega
(`taurus-alpha/docs/backend-requests/`). This increment closes the four "quick
win" ones — all additive fields on the `access` capability:

- **rename** a project (`project-updates.md` §1),
- a per-project **icon** key (`project-updates.md` §4),
- project **timestamps** (`createdAt`/`updatedAt`, `project-updates.md` §3),
- a user **display name** with a way to set it (README display-name item).

The two remaining requests — a full **member list / invite / roles** surface, and
a **visibility / link-access** model — are deliberately *not* here; the latter is
a real access-control decision that wants its own design pass.

Design decisions taken (Omega owns the contract):

- One unified, **owner-only** `PATCH /projects/:projectID` applies a partial
  `{name?, icon?}`. It lives in the **gated** tier (like `DELETE`/`leave`), doing
  its own owner check — it does *not* require a project to be selected.
- `icon` is an **opaque client-owned string** (≤ 64 runes, empty clears it); the
  backend never interprets the vocabulary.
- `name` (display) is trimmed, **≤ 80 runes**, empty allowed. It can be set at
  register time or via `PATCH /auth/me`.
- `updatedAt` bumps on every project mutation; timestamps serialize as RFC3339.

## Shape of the change

Low conceptual complexity, wide-but-shallow surface. There is no new subsystem
and no new control flow — it is four **additive fields** threaded through the
layers we already have, plus two thin endpoints to write them. `createdAt` even
existed on the domain `Project` already and was simply never surfaced on the wire;
`icon`, `updatedAt`, and the user `name` are new persisted columns. The bulk of
the diff is mechanical fan-out (each field touches the model, the SQLite store,
the in-memory store, a handler view, and their paired `*.go.md` docs) and the
paired-doc / change-record / dev-test discipline this repo keeps — not logic. The
one genuine judgment call was authorization (owner-only PATCH, self-only name),
which reuses `DeleteProject`'s existing shape rather than inventing anything.

## Files changed

The per-file sections below detail the six **source** files. For completeness, the
full surface of this increment:

- **Source (`core/`):** `capability/access/{access,project,memory}.go`,
  `platform/storage/sqlite/sqlite.go`, `handlers/project/project.go`,
  `handlers/auth/auth.go`, `transport/transport.go`.
- **Companion docs:** the sibling `*.go.md` for each source file above, updated
  verbatim in the same commit (the mechanical half of the diff).
- **Tests:** `capability/access/{access,project}_test.go`,
  `platform/storage/sqlite/sqlite_test.go`, `transport/transport_test.go`
  (`TestProjectAndUserFieldsRoundTrip`, `TestUpdateProject`, `TestSetUserName`,
  `TestPatchProject`, `TestAuthDisplayName`). All deterministic — no provider,
  no live cost.
- **Docs:** `docs/backend-guide.md` (endpoint tables + register example),
  `docs/architecture/capabilities/access.md` (fields, methods, HTTP surface,
  entity diagram).
- **Dev-test:** `dev-test/projects/{run.sh,manual.md}` (the project PATCH walk),
  `dev-test/gateway/{run.sh,manual.md}` (register-with-name + `PATCH /auth/me`).

Delivered as five commits, one per plan task
(`c625227`, `d114eaa`, `5ecfaa8`, `83ce578`, `538e456`), each self-contained and
green; the plan is `docs/superpowers/plans/2026-07-20-project-user-fields.md`.

## core/capability/access/project.go

### Project gains Icon and UpdatedAt

```go
type Project struct {
	ID        string
	Name      string
	Icon      string
	CreatedAt time.Time
	UpdatedAt time.Time
}
```

**What:** two fields on the domain project. **Goal:** carry the icon key and a
"last edited" time the cockpit's list column and project tile need. **Why on the
domain type:** the store and handler both project from it, so it is the single
source; `CreateProject` seeds `UpdatedAt` from `CreatedAt` so a new project has a
meaningful edit time immediately.

### ProjectChanges + UpdateProject — owner-gated partial edit

```go
type ProjectChanges struct {
	Name *string
	Icon *string
}

func (a *Access) UpdateProject(userID, projectID string, ch ProjectChanges) (Project, error) {
	// owner check (mirrors DeleteProject) → load → apply supplied fields → bump UpdatedAt → persist
}
```

**What:** the service method behind the PATCH endpoint. **Goal:** a partial update
where an omitted field is left untouched and an empty one is applied — hence
pointer fields. **Why owner-only:** the request specifies rename as owner-only;
icon rides along for now. The authorization shape reuses `DeleteProject`'s (a
non-member and a non-owner both collapse to `ErrForbidden`) so the endpoint never
reveals a project to someone who cannot edit it.

## core/capability/access/access.go

### User.Name, SetUserName, and Register(name)

```go
func (a *Access) Register(email, password, name string) (User, error) { ... }
func (a *Access) SetUserName(userID, name string) (User, error) { ... }
```

**What:** `User` gains `Name`; `Register` takes an optional name; `SetUserName`
sets it standalone. **Goal:** give the UI a real display name (avatar initials,
account menu) instead of deriving one from the email. **Why a setter too:** a
`name` field with no way to set it would be inert; register (sign-up) and
`PATCH /auth/me` (profile edit) are the two set paths. New sentinels
`ErrInvalidIcon`/`ErrInvalidDisplayName` bound the two free-text fields.

## core/platform/storage/sqlite/sqlite.go

### Columns via idempotent ALTER, with a backfill

```go
`ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''`,
`ALTER TABLE projects ADD COLUMN icon TEXT NOT NULL DEFAULT ''`,
`ALTER TABLE projects ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`,
// then: UPDATE projects SET updated_at = created_at WHERE updated_at = ''
```

**What:** three additive columns and a one-time backfill. **Goal:** persist the
new fields on existing databases without a rewrite. **Why this shape:** it follows
the file's established "run each ALTER, treat 'duplicate column name' as success"
pattern (works for both fresh and existing DBs); the backfill gives pre-existing
projects a real `updated_at` (they came through the ALTER with the empty default).
`UpdateProject`/`UpdateUserName` write the mutable columns and return
`access.ErrNotFound` when no row matched.

## core/handlers/project/project.go

### The Update handler and the widened view

```go
func (h Handlers) Update(ctx access.Context, req endpoint.Request) endpoint.Response { ... }
// projectJSON now carries icon, createdAt, updatedAt (RFC3339)
```

**What:** binds a partial `{name?, icon?}`, forwards to `UpdateProject`, and maps
each sentinel to a status (`403`/`400`/`404`/`500`); every project response now
includes `icon`, `createdAt`, `updatedAt`. **Goal:** the HTTP surface for rename
and icon, plus the timestamps the list needs. **Why RFC3339 in the handler:** the
domain keeps `time.Time`; the wire boundary is where the string format is chosen.

## core/handlers/auth/auth.go

### Name on the wire: /auth/me, PATCH /auth/me, register

```go
// credentials + userJSON gain Name; Register passes in.Name
func (h Handlers) UpdateName(ctx access.Context, req endpoint.Request) endpoint.Response { ... }
```

**What:** `GET /auth/me` returns `name`; `PATCH /auth/me {name}` sets it; register
accepts an optional `name` (over-long → `400`). **Goal:** expose the display name
end to end. **Why scoped to `ctx.User`:** the setter never takes a user id from the
body — the gate's resolved identity is the only account a caller can edit.

## core/transport/transport.go

### Two gated routes

```go
gated.PATCH("/projects/:projectID", s.adaptScoped(projects.Update))
gated.PATCH("/auth/me", s.adaptScoped(auth.UpdateName))
```

**What:** wire the two new handlers into the gated group. **Goal:** reachable by
any signed-in user, with per-request authorization done inside the handler/service
(owner for the project PATCH; self for the name PATCH). **Why gated, not
project-scoped:** editing a project you own or your own profile does not require a
project to be *selected* into the session.

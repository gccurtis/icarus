# Project visibility / link access — implementation plan

> Derived from `docs/superpowers/specs/2026-07-20-members-and-visibility-design.md`
> (Design B). Members (Design A) shipped in record 0015. Execute task-by-task,
> TDD, committing per task; each task ends green (`go test ./...`).

**Goal:** A per-project visibility setting (`private` | `link`) plus a self-serve
join: any signed-in user who opens a `link`-visible project auto-joins as a `read`
member. No anonymous access, no gate/scoping changes — access still flows from a
real membership row.

**Constraints:** Companion `*.go.md` updated verbatim in the same commit as each
source change. Unit-level tests only. Reuse the existing owner-only
`PATCH /projects/:projectID` (via `ProjectChanges`) for the toggle — no new toggle
endpoint. One new endpoint for joining.

## Global names

```go
// access/project.go
type Visibility string
const ( VisibilityPrivate Visibility = "private"; VisibilityLink Visibility = "link" )
// Project gains: Visibility Visibility
// ProjectChanges gains: Visibility *string
func (a *Access) JoinProject(userID, projectID string) (Project, Role, error)
// helper: validVisibility(Visibility) bool

// access/access.go
ErrInvalidVisibility = errors.New("visibility must be private or link")
```

---

### Task 1 — Visibility field + storage

**Files:** `access/project.go` (+`.md`), `sqlite/sqlite.go` (+`.md`),
`sqlite/sqlite_test.go`. (memory store needs no change — it stores the whole
`Project` value; the default is seeded by the access layer.)

- Add the `Visibility` type + constants and the `Project.Visibility` field.
- `CreateProject` seeds `VisibilityPrivate`.
- SQLite: `ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'`
  (existing rows become private, no backfill needed). Thread `visibility` through
  `CreateProject`/`ProjectByID`/`ProjectsForUser`/`UpdateProject` (scan into a
  string, cast to `Visibility`).
- Extend `TestProjectAndUserFieldsRoundTrip` (or a focused test): a created
  project is `private`; `UpdateProject` with `link` persists; `ProjectsForUser`
  carries it.
- Commit: `feat(access): persist project visibility (default private)`.

### Task 2 — Service: PATCH visibility + JoinProject

**Files:** `access/project.go` (+`.md`), `access/access.go` (+`.md`),
`access/project_test.go`.

- Add `ErrInvalidVisibility`; add `Visibility *string` to `ProjectChanges`; in
  `UpdateProject`, when non-nil, `validVisibility` → set or `ErrInvalidVisibility`.
- `CreateProject` seeds `VisibilityPrivate` (Task 1) — confirm.
- Add `JoinProject`:

```go
func (a *Access) JoinProject(userID, projectID string) (Project, Role, error) {
	p, err := a.stores.Projects.ProjectByID(projectID)
	if errors.Is(err, ErrNotFound) { return Project{}, "", ErrNotFound } else if err != nil { return Project{}, "", err }
	if m, err := a.stores.Memberships.Membership(userID, projectID); err == nil {
		return p, m.Role, nil                    // already a member: idempotent
	} else if !errors.Is(err, ErrNotFound) {
		return Project{}, "", err
	}
	if p.Visibility != VisibilityLink {
		return Project{}, "", ErrNotFound        // never reveal a private project to a non-member
	}
	if err := a.stores.Memberships.AddMembership(Membership{UserID: userID, ProjectID: projectID, Role: RoleRead}); err != nil {
		return Project{}, "", err
	}
	return p, RoleRead, nil
}
```

- Tests: `TestSetVisibility` (owner sets link; bad value → `ErrInvalidVisibility`;
  non-owner → `ErrForbidden`), `TestJoinProject` (non-member joins a link project
  as read; private → `ErrNotFound`; existing member is idempotent with their role;
  unknown project → `ErrNotFound`).
- Commit: `feat(access): project visibility toggle + link self-join`.

### Task 3 — HTTP: visibility in the view, PATCH, join endpoint

**Files:** `handlers/project/project.go` (+`.md`), `transport/transport.go`
(+`.md`), `transport/transport_test.go`.

- `projectJSON` gains `Visibility string json:"visibility"`; `view` sets it.
- `Update` handler binds `Visibility *string`, passes it in `ProjectChanges`, and
  maps `ErrInvalidVisibility` → `400`.
- Add `Join` handler → `view(p, role)`; `ErrNotFound` → `404`.
- Route: `gated.POST("/projects/:projectID/join", s.adaptScoped(projects.Join))`.
- Transport test `TestProjectVisibility`: default `private`; owner PATCHes to
  `link` (200, view shows it); a second user joins (200, role `read`, now in the
  member list); a third user cannot join a private project (404); bad visibility
  value → 400.
- Commit: `feat(project): visibility in view + PATCH + join endpoint`.

### Task 4 — Docs + dev-test

**Files:** `docs/records/0016-project-visibility.md` (new), `docs/backend-guide.md`,
`docs/architecture/capabilities/access.md`, `dev-test/projects/{run.sh,manual.md}`.

- Record 0016: what/goal/why per file; the "link = signed-in auto-join as read"
  decision; that flipping link→private does not evict existing members; what is
  out of scope (anonymous/ephemeral access).
- backend-guide §5: note `visibility` on the project payload, the PATCH value, and
  the `POST /projects/:id/join` row.
- access.md: `Visibility` field, the toggle, `JoinProject`, HTTP surface row,
  entity note.
- dev-test/projects: a second user joins the (link-set) project; a `private`
  project rejects a join (404). Keep the run green.
- Commit: `docs: record 0016; document visibility in guide, access, dev-test`.

## Self-review
- `private|link`, default private, ALTER (no backfill needed): Task 1. ✔
- Toggle reuses PATCH; join is the one new endpoint; link=auto-join-read: Tasks 2–3. ✔
- Idempotent for existing members; private never revealed to non-members: Task 2. ✔
- No gate/scoping changes (access still via membership). ✔
- Out of scope (anonymous, ephemeral, invites): recorded, not built. ✔

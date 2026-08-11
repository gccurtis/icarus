# Project members — implementation plan

> Derived from `docs/superpowers/specs/2026-07-20-members-and-visibility-design.md`
> (Design A). Visibility (Design B) is a later increment. Execute task-by-task,
> TDD, committing per task; each task ends green (`go test ./...`).

**Goal:** Owner-managed project membership over existing accounts — list, add by
email, change role, remove — with the invariant that a project always keeps ≥ 1
owner (enforced on remove, change-role, and leave).

**Constraints:** Companion `*.go.md` updated verbatim in the same commit as each
source change. Unit-level tests only (deterministic). Add-existing-user only (no
invites/email). Reuse existing patterns (`normalizeEmail`, `AddMembership` is
`INSERT OR REPLACE` so it doubles as a role update).

## Global names (used across tasks)

```go
// access/project.go
type ProjectMember struct { UserID, Name, Email string; Role Role }

// access/access.go sentinels
ErrAlreadyMember = errors.New("user is already a member")
ErrInvalidRole   = errors.New("role must be owner, edit, or read")
ErrLastOwner     = errors.New("a project must keep at least one owner")

// MembershipStore
MembersForProject(projectID string) ([]ProjectMember, error)

// Access methods
ProjectMembers(actorID, projectID string) ([]ProjectMember, error)
AddProjectMember(actorID, projectID, email string, role Role) (ProjectMember, error)
SetMemberRole(actorID, projectID, targetID string, role Role) error
RemoveMember(actorID, projectID, targetID string) error
// requireOwner(actorID, projectID) error — shared owner gate (DeleteProject/UpdateProject refactored onto it)
// helpers: validRole(Role) bool · ownerCount([]ProjectMember) int · findMember([]ProjectMember, id) (ProjectMember, bool)
```

---

### Task 1 — ProjectMember type, sentinels, `MembersForProject` store

**Files:** `access/project.go` (+`.md`), `access/access.go` (+`.md`),
`access/memory.go` (+`.md`), `sqlite/sqlite.go` (+`.md`), `sqlite/sqlite_test.go`.

- Add `ProjectMember` to `project.go`; add `MembersForProject` to the
  `MembershipStore` interface; add the three sentinels to `access.go`.
- SQLite impl (JOIN memberships→users, `ORDER BY u.email`):

```go
func (s *Store) MembersForProject(projectID string) ([]access.ProjectMember, error) {
	rows, err := s.db.Query(`
		SELECT u.id, u.name, u.email, m.role
		FROM memberships m
		JOIN users u ON u.id = m.user_id
		WHERE m.project_id = ?
		ORDER BY u.email`, projectID)
	if err != nil { return nil, err }
	defer rows.Close()
	var out []access.ProjectMember
	for rows.Next() {
		var m access.ProjectMember
		var role string
		if err := rows.Scan(&m.UserID, &m.Name, &m.Email, &role); err != nil { return nil, err }
		m.Role = access.Role(role)
		out = append(out, m)
	}
	return out, rows.Err()
}
```

- Memory impl: scan `memberships` for the project, join each to `users`.
- Test `TestMembersForProject`: two users + owner/read memberships → both rows,
  correct name/email/role, ordered by email.
- Commit: `feat(access): ProjectMember + MembersForProject store`.

### Task 2 — Access service (owner gate, add, role, remove, leave guard)

**Files:** `access/project.go` (+`.md`), `access/project_test.go`.

- Add `requireOwner` and refactor `DeleteProject`/`UpdateProject` to call it (they
  duplicate the exact check today). Add `validRole`/`ownerCount`/`findMember`.
- Add `ProjectMembers` (member-only read → `ErrForbidden` for non-members),
  `AddProjectMember` (owner; `validRole`→`ErrInvalidRole`; `UserByEmail(normalizeEmail(email))`
  → `ErrNotFound`; existing membership → `ErrAlreadyMember`; else `AddMembership`),
  `SetMemberRole` (owner; last-owner demote → `ErrLastOwner`; `AddMembership`
  replaces the role), `RemoveMember` (owner; last-owner → `ErrLastOwner`).
- `LeaveProject`: if caller is an owner and `ownerCount == 1` → `ErrLastOwner`.
- Tests: `TestProjectMembers` (list + non-member forbidden), `TestAddProjectMember`
  (add existing, 404 unknown email, dup, bad role, non-owner forbidden),
  `TestMemberRoleAndRemove` (promote, demote, last-owner guard on demote/remove),
  and **update `TestLeaveProject`**: a sole owner leaving now → `ErrLastOwner`;
  a non-last member leaves successfully (add a second owner, then original leaves).
- Commit: `feat(access): owner-managed membership + last-owner invariant`.

### Task 3 — HTTP handlers + routes

**Files:** `handlers/project/project.go` (+`.md`), `transport/transport.go`
(+`.md`), `transport/transport_test.go`.

- `memberJSON{userId,name,email,role}` + `memberView`. Handlers `Members` (GET,
  any member → `{members:[…]}`), `AddMember` (POST, owner), `SetMemberRole`
  (PATCH), `RemoveMember` (DELETE). Map sentinels: `ErrForbidden`→403,
  `ErrInvalidRole`→400, `ErrNotFound`→404, `ErrAlreadyMember`→409,
  `ErrLastOwner`→409. Add `ErrLastOwner`→409 to the existing `Leave` handler.
- Routes (gated):

```go
gated.GET("/projects/:projectID/members", s.adaptScoped(projects.Members))
gated.POST("/projects/:projectID/members", s.adaptScoped(projects.AddMember))
gated.PATCH("/projects/:projectID/members/:userID", s.adaptScoped(projects.SetMemberRole))
gated.DELETE("/projects/:projectID/members/:userID", s.adaptScoped(projects.RemoveMember))
```

- Transport test `TestProjectMembers`: owner creates project; register a 2nd user;
  owner adds them by email (201); `GET members` shows both; PATCH role; the 2nd
  user leaves; owner-as-last-owner leave → 409; add unknown email → 404; non-owner
  add → 403.
- Commit: `feat(project): member list / add / role / remove endpoints`.

### Task 4 — Docs + dev-test

**Files:** `docs/records/0015-project-members.md` (new), `docs/backend-guide.md`,
`docs/architecture/capabilities/access.md`, `dev-test/projects/{run.sh,manual.md}`.

- Record 0015: what/goal/why per changed file; note the add-existing model and the
  ≥1-owner invariant (and that it closes the old sole-owner `leave` footgun).
- backend-guide §5: four member rows; note `leave` now 409 for a sole owner.
- access.md: `ProjectMember`, the four methods, the invariant, HTTP surface rows.
- dev-test/projects: register a 2nd user, add them, list members, change role, have
  the 2nd user leave (success), show sole-owner leave → 409. Fix the existing
  "leave the first project" step (a sole owner now gets 409 — delete instead, or
  leave as the non-last member).
- Commit: `docs: record 0015; document members in guide, access, dev-test`.

## Self-review
- Add-existing (no invites), owner-managed, ≥1-owner on remove/role/leave: Task 2. ✔
- Member list identity uses `name`+`email` join: Task 1. ✔
- Endpoints + status mapping: Task 3. ✔
- `AddMembership` doubling as role-update avoids a new store method. ✔
- Existing `TestLeaveProject` + dev-test leave step must change (guard) — called out in Tasks 2 & 4. ✔

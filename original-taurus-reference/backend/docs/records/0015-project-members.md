# 0015 — Project members (owner-managed, ≥ 1 owner)

Closes the High-priority Taurus Alpha backend request
(`taurus-alpha/docs/backend-requests/project-members.md`): the cockpit can now
read a project's real member list and manage membership — add by email, change
role, remove — instead of showing only the signed-in user and mocking the rest.

Design (`docs/superpowers/specs/2026-07-20-members-and-visibility-design.md`,
Design A):

- **Add existing users only.** Adding a member resolves an existing email to an
  account and creates the membership immediately. No pending invites, no tokens,
  no email (Omega has no email sender). If a sign-up/email flow ever appears,
  pending invites slot in behind the same endpoints.
- **A project always keeps ≥ 1 owner.** Enforced in the access service across
  *every* mutating path — remove, change-role, and leave — as `ErrLastOwner`.
  This also closes a pre-existing footgun: a sole owner could previously `leave`
  and permanently strand the project.
- **Read = any member; manage = owner-only.** Listing members is open to any
  member; add/remove/change-role require owner.

The identity a member row needs (`name`, `email`) is already available — the
`name` field shipped in record 0014 — so no user-model change was required.

## core/capability/access/project.go

### ProjectMember and MembersForProject

```go
type ProjectMember struct { UserID, Name, Email string; Role Role }
// MembershipStore.MembersForProject(projectID) ([]ProjectMember, error)
```

**What:** a join type (member identity + role) and the store read that produces
it. **Goal:** one query backs both the member-list endpoint and the owner-count
the guard needs. **Why on `MembershipStore`:** it is the mirror of
`ProjectStore.ProjectsForUser` — a project's members vs. a user's projects.

### requireOwner + the member service methods

```go
func (a *Access) requireOwner(userID, projectID string) error // shared owner gate
func (a *Access) ProjectMembers(actorID, projectID string) ([]ProjectMember, error)
func (a *Access) AddProjectMember(actorID, projectID, email string, role Role) (ProjectMember, error)
func (a *Access) SetMemberRole(actorID, projectID, targetID string, role Role) error
func (a *Access) RemoveMember(actorID, projectID, targetID string) error
```

**What:** the owner-managed membership operations, plus a `requireOwner` helper
that `DeleteProject` and `UpdateProject` were **refactored onto** (they duplicated
the exact check). **Goal / why:** put all authorization and the ≥ 1-owner
invariant in one layer, expressed once. Notes:

- `AddProjectMember` normalizes the email the same way login/registration do, so
  `EDIT@x.com` and `edit@x.com` are the same account; a missing account is
  `ErrNotFound` (→ `404`), an existing member `ErrAlreadyMember` (→ `409`).
- `SetMemberRole` reuses `AddMembership` (an upsert on `(user_id, project_id)`) as
  the role write — no separate store method — and allows promoting to `owner`, so
  a departing owner can hand off first.
- The **last-owner guard** (`ownerCount == 1` and the target/leaver is that owner)
  lives in `SetMemberRole`, `RemoveMember`, and `LeaveProject`.

### LeaveProject gains the guard

```go
if m.Role == RoleOwner && ownerCount(members) == 1 { return ErrLastOwner }
```

**What/why:** a sole owner leaving now returns `ErrLastOwner` instead of stranding
the project — the one behavior change to an existing endpoint, deliberate.

## core/capability/access/access.go

### New sentinels

```go
ErrAlreadyMember = errors.New("user is already a member")
ErrInvalidRole   = errors.New("role must be owner, edit, or read")
ErrLastOwner     = errors.New("a project must keep at least one owner")
```

**What/goal/why:** typed outcomes the handlers map to `409`/`400`/`409` — the
add-conflict, the bad-role rejection, and the invariant, each nameable with
`errors.Is` rather than string-matched.

## core/platform/storage/sqlite/sqlite.go · core/capability/access/memory.go

### MembersForProject implementations

**What:** SQLite `JOIN memberships → users` filtered to one project, ordered by
email; the memory store scans its maps for the same join. **Goal/why:** the member
list resolves identities in one round-trip (SQLite) while the in-memory store keeps
unit tests DB-free, matching the existing `ProjectsForUser` split.

## core/handlers/project/project.go

### Member endpoints + memberJSON view

```go
// Members (any member) · AddMember · SetMemberRole · RemoveMember (owner)
type memberJSON struct { UserID, Name, Email, Role string `json:"userId,…"` }
```

**What:** four thin handlers over the service, plus the `ErrLastOwner` → `409`
case added to `Leave`. **Goal/why:** the HTTP surface for member management; the
handlers hold no policy — they only translate service sentinels to status codes.

## core/transport/transport.go

### The gated member subresource

```go
gated.GET   /projects/:projectID/members
gated.POST  /projects/:projectID/members
gated.PATCH /projects/:projectID/members/:userID
gated.DELETE /projects/:projectID/members/:userID
```

**What/why:** gated (any signed-in user), with owner/membership checks inside —
consistent with the existing `/projects/:id` management routes. They do not
require a project to be *selected* into the session.

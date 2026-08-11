# Members & visibility — design

Closes the two remaining Taurus Alpha backend requests
(`taurus-alpha/docs/backend-requests/`): **project members** (High) and
**visibility / link access** (Medium). Both stay entirely inside the `access`
capability and the existing **membership** model — no new subsystem, no gate or
scoping changes.

Build order: **members first**, then visibility. Both designs are captured here;
the members implementation plan is derived from Design A.

## Design A — Project members

Owner-managed membership over accounts that already exist. Adding a member
resolves an existing email to a user and creates a membership immediately — there
are **no pending invites, no tokens, and no email** (Omega has no email sender;
accounts are created out of band). If a sign-up/email flow ever appears, pending
invites slot in behind the same endpoints without reshaping them.

### Invariant: a project always has ≥ 1 owner

Enforced in the access service across **every** mutating path — remove member,
change role, and leave. Removing or demoting the sole owner, or leaving as the
sole owner, returns `409 Conflict`. To step down, an owner promotes someone else
first (or deletes the project). This also closes the existing footgun where a sole
owner could `leave` and strand the project.

### Model / store

No new tables. Add one joined read to the store:

- `MembersForProject(projectID) ([]ProjectMember, error)` — memberships joined to
  users, one row per member. `ProjectMember{ UserID, Name, Email string; Role Role }`
  (uses the `name` field added in record 0014). One SQL `JOIN` in the SQLite
  store; the in-memory store joins across its maps. The service derives the
  owner-count for the guard from this same list (filter `Role == owner`), so no
  separate count method is needed.

New sentinel: `ErrAlreadyMember` (add-member conflict). `ErrLastOwner` (the
guard). Reuse `ErrNotFound`/`ErrForbidden`/`ErrInvalidName`-style patterns.

### Access service (all policy here)

- `ProjectMembers(actorID, projectID) ([]ProjectMember, error)` — caller must be a
  member (else `ErrForbidden`); returns the list.
- `AddProjectMember(actorID, projectID, email string, role Role) (ProjectMember, error)`
  — **owner-only**; validate `role ∈ {owner, edit, read}` (else `ErrInvalidRole`);
  resolve email→user (`ErrNotFound` if no account); `ErrAlreadyMember` if the user
  is already a member; add the membership; return the joined view.
- `SetMemberRole(actorID, projectID, targetID string, role Role) error` —
  owner-only; validate role; if this would demote the **last owner**, `ErrLastOwner`.
- `RemoveMember(actorID, projectID, targetID string) error` — owner-only; if the
  target is the **last owner**, `ErrLastOwner`. (An owner may remove themselves
  here, subject to the guard; `leave` remains the idiomatic self-exit.)
- `LeaveProject` — extend with the last-owner guard (`ErrLastOwner`).

Role rules: an owner **may promote another member to owner** — multiple owners are
allowed; the guard only protects the *last* one.

### HTTP surface (gated tier)

These live in the **gated** group (any signed-in user), with `:projectID` in the
path and authorization done inside the handler/service — exactly like the existing
`PATCH`/`DELETE /projects/:projectID` and `/leave`. They do **not** require a
project to be *selected* into the session.

```http
GET    /projects/:projectID/members
  # any member → 200 { "members": [ { "userId", "name", "email", "role" } ] }
  # non-member → 403

POST   /projects/:projectID/members            { "email", "role" }
  # owner → 201 { "userId", "name", "email", "role" }
  # 404 no such user · 409 already a member · 400 bad role · 403 not owner

PATCH  /projects/:projectID/members/:userId    { "role" }
  # owner → 200
  # 409 would remove last owner · 400 bad role · 403 not owner · 404 not a member

DELETE /projects/:projectID/members/:userId
  # owner → 200
  # 409 would remove last owner · 403 not owner · 404 not a member
```

Read the member list = **any member**; add/remove/change-role = **owner-only**.

### Front-end follow-up (taurus-alpha, not this repo)

Replace `addMemberMock`/`setMemberRoleMock`/`removeMemberMock` with real calls;
populate `Project.members` from `GET …/members`; drop the "Mock" badges. Closes
`taurus-alpha/docs/backend-requests/project-members.md`.

## Design B — Visibility / link access (build after members)

A per-project visibility setting plus a self-serve join grant. "Anyone with the
link" means **any signed-in user** — opening a link-visible project **auto-joins
them as a `read` member**. No anonymous access, no ephemeral non-member access.
Because access still flows from a real membership row, there are **zero gate or
scoping changes**.

### Model

- Add `Visibility` to `Project`: `"private" | "link"`, default `"private"`.
  Persisted via an idempotent `ALTER TABLE projects ADD COLUMN visibility …
  DEFAULT 'private'`. Surface it in the project JSON view.

### Setting it — reuse the existing PATCH

Extend `access.ProjectChanges` with `Visibility *string` and let the existing
owner-only `PATCH /projects/:projectID` set it (validated to the two values, else
a `400`). No new endpoint for the toggle.

```http
PATCH /projects/:projectID   { "visibility": "private" | "link" }   # owner only
```

### Joining via the link — one new endpoint

```http
POST /projects/:projectID/join     # any signed-in user
  # link-visible & caller not a member → create a READ membership → 200 { project, "role":"read" }
  # already a member                    → idempotent, return existing role
  # private (or unknown)                → 404 (never confirm existence to a non-member)
```

The front-end calls this when a signed-in user opens a shared `/projects/:id`
link. Afterward they are an ordinary read member, so `POST /session/project` and
every downstream route work unchanged.

Semantics of flipping `link → private`: it stops *new* self-joins only; it does
**not** evict members who already joined (they hold real memberships — the owner
removes them via the member endpoints if desired).

### Front-end follow-up

Swap `setVisibilityMock` → `PATCH /projects/:id`, drop the "Mock" badge on Access,
and treat the share link as a real grant (call `…/join` on open). Closes the
visibility part of `taurus-alpha/docs/backend-requests/project-updates.md`.

## Explicitly out of scope

- **Anonymous / guest access** to link-shared projects (needs a guest-identity
  concept; breaks the cookie-gated model).
- **Ephemeral non-member access** (needs the gate to grant a role from visibility
  rather than membership).
- **Pending invites** and **email-sent invitations** (need an invites table,
  acceptance flow, and an email sender).
- Project `icon`/`updatedAt`/display-name work — shipped in record 0014.

## Testing & docs (both features)

Unit-level only (deterministic, no provider, no live cost): access-service tests
for each policy branch (owner gate, last-owner guard, add-existing, dup, bad
role, auto-join) with memory-store parity; sqlite round-trip for the new
read/column; transport tests for each route. Companion `*.go.md` updated verbatim
per changed source file; a change record per increment (members = 0015, visibility
= 0016); backend-guide + `architecture/capabilities/access.md` updated; the
`dev-test/projects` suite + manual extended (a second registered user for the
member and join walkthroughs).

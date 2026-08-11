# 0016 — Project visibility / link access

Closes the visibility part of the Taurus Alpha backend request
(`taurus-alpha/docs/backend-requests/project-updates.md`): a project can now be
`private` (members only) or `link` ("anyone with the link"), and the link is a
real access grant rather than a client-only affordance.

Design (`docs/superpowers/specs/2026-07-20-members-and-visibility-design.md`,
Design B). The one architectural decision this hinged on:

- **"Anyone with the link" means any *signed-in* user, who auto-joins as a `read`
  member.** Omega is cookie-gated and scopes every request by a **membership**
  row; rather than break that, opening a `link`-visible project creates a plain
  read membership. After that the user is an ordinary member — so scoping, roles,
  the member list, and project selection all keep working with **zero gate or
  scoping changes**.
- Deliberately **not** built (and why): **anonymous access** (would need a
  guest-identity concept and break the cookie-gated model), **ephemeral
  non-member access** (would need the gate to grant a role from visibility, not
  membership), and **email-sent link invitations**.

Two safety properties fall out of the design:

- A `private` project is **indistinguishable from a missing one** to a non-member
  — `JoinProject` returns `ErrNotFound` for both, so the link endpoint never
  confirms a private project's existence.
- Flipping `link → private` **does not evict** members who already joined (they
  hold real memberships); it only stops new self-joins. The owner removes them via
  the member endpoints (record 0015) if desired.

## core/capability/access/project.go

### The Visibility type and the Project field

```go
type Visibility string
const ( VisibilityPrivate Visibility = "private"; VisibilityLink Visibility = "link" )
// Project gains: Visibility Visibility ; CreateProject seeds VisibilityPrivate
```

**What/goal/why:** a typed, self-documenting access mode (mirroring `Role`),
defaulting to `private` on create so a new project is members-only until the owner
opts in.

### JoinProject and the PATCH branch

```go
func (a *Access) JoinProject(userID, projectID string) (Project, Role, error)
// ProjectChanges gains Visibility *string; UpdateProject validates via validVisibility
```

**What:** the visibility toggle reuses the existing owner-only `UpdateProject`
(via `ProjectChanges.Visibility`, rejecting a bad value with
`ErrInvalidVisibility`); `JoinProject` is the self-join. **Goal:** put the toggle
on the PATCH we already have (no new toggle endpoint) and express link access as a
single, auditable service method. **Why this shape:** `JoinProject` short-circuits
for an existing member (idempotent, keeps their role), only self-joins on
`VisibilityLink`, and collapses private/missing to `ErrNotFound` — the three rules
that keep link access from leaking or privilege-escalating live in one place.

## core/capability/access/access.go

### ErrInvalidVisibility

```go
ErrInvalidVisibility = errors.New("visibility must be private or link")
```

**What/why:** the typed rejection the PATCH handler maps to `400`.

## core/platform/storage/sqlite/sqlite.go

### The visibility column

```go
`ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'`
```

**What:** an idempotent additive column, threaded through
`CreateProject`/`ProjectByID`/`ProjectsForUser`/`UpdateProject`. **Goal/why:** the
`'private'` default means existing projects stay members-only across the migration
with no backfill — the safe default on an access-control field.

(The in-memory store needed no change — it stores the whole `Project` value; the
default is seeded by the access layer.)

## core/handlers/project/project.go

### visibility in the view, the PATCH binding, the Join handler

```go
// projectJSON gains `visibility`; Update binds Visibility *string
// (ErrInvalidVisibility -> 400); new Join handler
func (h Handlers) Join(ctx access.Context, req endpoint.Request) endpoint.Response
```

**What/goal/why:** every project payload now carries `visibility`; the owner sets
it through the same PATCH as rename/icon; `Join` backs the link URL. `Join`'s only
named error is `ErrNotFound` → `404` (private *or* missing), preserving the
no-leak property at the HTTP edge.

## core/transport/transport.go

### The join route

```go
gated.POST("/projects/:projectID/join", s.adaptScoped(projects.Join))
```

**What/why:** gated (any signed-in user), authorization handled inside the service
by the project's visibility — consistent with the other `/projects/:id` routes,
and requiring no selected project.

# sqlite_access.go

`sqlite_access.go` is the durable identity-and-authority layer: the SQLite
implementations of the `access` capability's four stores — users, sessions,
projects, memberships — plus project share links. These are the tables the
control gate consults on the way into every request: resolve the session cookie
to a session, the session to a user, the user's membership in the project to a
role. Nothing else in the system is asked more often, and nothing else decides
whether a request proceeds at all.

Like every file in this package it holds methods on the one shared `*Store` and
adds no state of its own; the split mirrors `core/capability` so each domain's
persistence reads on its own. Two conventions run through the whole file. First,
`sql.ErrNoRows` is translated to `access.ErrNotFound`, so callers see the
capability's own vocabulary rather than a driver error — and for updates, a
successful statement that affected zero rows means the same thing and is
translated identically. Second, timestamps are stored as `timeLayout` text and
parsed back with the error discarded, so an unreadable timestamp degrades to the
zero time instead of failing an authorization lookup.

## Code breakdown

### Package doc and imports

Names the file's domain — users, sessions, projects, memberships, share links —
and restates that the package split is organizational. Imports are the `access`
capability for its types and `ErrNotFound`, `database/sql` and `errors` for the
no-rows translation, `strings` for the batched `IN` clause, and `time`.

### CreateUser: insert a user row

A plain insert of id, email, name, password hash and creation time. No
uniqueness check here — the email unique constraint in the schema is the
authority, and a duplicate surfaces as a driver error the capability maps.

### UserByID and UserByEmail: the two identity lookups

Same projection, different key: by id for session resolution, by email for
login. Both delegate scanning to `scanUser`, so the column list and the
not-found behaviour stay in one place.

### UpdateUserName and UpdateUserProfile: the two profile writes

`UpdateUserName` sets just the display name; `UpdateUserProfile` also sets the
per-user color and avatar URL. Both check `RowsAffected() == 0` and return
`access.ErrNotFound`, which is what distinguishes "no such user" from "the
update ran and changed nothing" — SQLite reports both as a successful statement.

### scanUser: the shared user row decoder

Scans one row into an `access.User` from either lookup, converting `ErrNoRows`
into `access.ErrNotFound` and parsing `created_at`. It takes a `*sql.Row`, which
is why it serves the two single-row lookups but not a multi-row query.

### Sessions: create, read, update, delete

`CreateSession`, `SessionByID`, `UpdateSession` and `DeleteSession` are the
session lifecycle. A session carries its user, its currently selected project,
and both timestamps; `UpdateSession` rewrites all of them, which is how switching
the active project and extending an expiry are both expressed. Expiry is *not*
enforced here — the row is returned regardless and the capability decides whether
it is still valid. `DeleteSession` is unconditional and idempotent: logging out an
already-deleted session is not an error.

### Projects: create, read, delete, update

`CreateProject` and `ProjectByID` round-trip the project record (name, icon,
purpose, visibility, timestamps), with `Visibility` stored as its string value.
`DeleteProject` removes only the project row and is idempotent. `UpdateProject`
rewrites the mutable fields and, like the user updates, maps a zero-row result to
`access.ErrNotFound`.

### ProjectsForUser: a user's projects with their role in each

Joins `projects` to `memberships` on the user, ordered by project creation time,
returning `ProjectMembership` values — the project plus the caller's role. This
is the query behind a user's project list, and returning the role alongside means
the UI does not need a second round trip per project to know what the user may
do.

### Memberships: add, read, remove

`AddMembership` uses `INSERT OR REPLACE`, making it an upsert: granting a role
someone already holds, or changing their role, is the same call. `Membership`
reads back one `(user, project)` pair and is the gate's authorization lookup,
returning `access.ErrNotFound` when the user is not a member — the "no" answer.
`RemoveMembership` deletes one pair.

### RemoveProjectMemberships: drop every membership of a project

The bulk companion used when a project is deleted. It exists because
`DeleteProject` does not cascade: project teardown is an explicit sequence of
deletes, so each table's cleanup is visible at the call site rather than hidden
in schema behaviour.

### MembersForProject: the project's member list

Joins `memberships` to `users`, ordered by email for a stable listing, returning
id, name, email and role per member. This is the full member view, shown to
someone already inside the project.

### MembersSummaryByProjects: a bounded, public-safe summary for many projects at once

The batched read behind project listings: one query over an `IN` clause of
project ids, returning per project up to `limit` members (ordered by email) plus
the *exact* total. Rows are ordered by `(project_id, email)` so the truncation is
deterministic, and the counter is incremented for every row while only the first
`limit` are appended — the total stays exact even though the list is capped. The
projection is deliberately narrow (user id, name, avatar) rather than reusing
`MembersForProject`: email is not exposed in a summary that can be shown to
non-members. A final pass ensures every requested project has an entry, so a
project with no members yields a zero summary rather than a missing key.

### Project share links: put, lookup by token, list, delete

`PutProjectLink` upserts on `(project_id, role)`, which encodes the invariant
that a project has at most one share link per role — regenerating a link replaces
its token in place. `ProjectLinkByToken` is the redemption path, resolving a
token to its project and role (`ErrNotFound` for an unknown or revoked token).
`ProjectLinksForProject` lists a project's links ordered by role,
`DeleteProjectLink` revokes one role's link, and `RemoveProjectLinks` is the
project-teardown bulk delete, paired with `RemoveProjectMemberships`.

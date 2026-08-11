# sqlite_organization.go

Persistence for organizations and their role-based memberships — two tables,
`organizations` (id, name, timestamps) and `org_memberships` (org, user, role,
composite primary key).

Organizations sit **above** projects. A user↔organization link is one of the
deliberate exceptions to this system's otherwise-absolute project scoping,
because an organization spans projects — which is why neither table carries a
`project_id`. Crucially, an organization never *grants* project access: the
resource access-scope resolver consults org membership only to **narrow** which
of a project's existing members may see a resource. Reading a membership row
here answers "is this user in that org", never "may this user enter that
project".

The store is also unopinionated about roles. The rules that matter — that only
an owner may grant the owner role, that the last owner can never be demoted or
removed — are enforced in the `organization` capability. This file will happily
write whatever role string it is handed.

## Code breakdown

### File header: one Store, one connection, split by capability

The package clause repeats the note carried by every file in this split: all of
these methods hang off the same `*Store` over a single connection, so the file
boundary is organizational and mirrors `core/capability`.

### `CreateOrganization` — insert as given

A plain insert of id, name, and both timestamps formatted with the package
`timeLayout`. IDs and times come from the caller.

### `OrganizationByID` — single-row read

Scans inline (there is no shared org row decoder) and maps `sql.ErrNoRows` to
`organization.ErrNotFound` so callers above see a domain error rather than a
`database/sql` one. Timestamps are parsed back with `timeLayout`, leaving the
zero time on a bad value rather than failing the read.

### `UpdateOrganization` — rename, and nothing else

Writes only `name` and `updated_at`; the ID and creation time are fixed. A zero
`RowsAffected` is translated to `ErrNotFound`, so updating an organization that
does not exist is reported rather than silently succeeding.

### `AddOrgMembership` — upsert a user's standing

An insert with `ON CONFLICT(org_id, user_id) DO UPDATE SET role = excluded.role`,
so "add" is idempotent and doubles as a role change for a user already in the
org. There is no membership timestamp — the row is just the fact of belonging.

### `RemoveOrgMembership` — delete, missing row is fine

Deletes the `(org_id, user_id)` row without inspecting `RowsAffected`. Removing
a user who is not a member succeeds, which keeps the caller's retry path simple.

### `SetOrgMembershipRole` — strict counterpart to the upsert

Unlike `AddOrgMembership`, this only mutates an existing row and returns
`ErrNotFound` when none matched. The pair is deliberate: "add" may create,
"set role" may not — a role change aimed at a non-member is a mistake worth
surfacing, not a way in.

### `OrgMembershipsByUser` — every org a user belongs to

One line delegating to `scanOrgMemberships`. This is the read behind the
access-scope resolver's `UserOrgIDs`, called on the resource-visibility path.

### `OrgMembershipsByOrg` — every member of one org

The mirror-image query, same helper. Together the two queries explain the
`idx_org_memberships_user` index: the primary key already covers lookups that
lead with `org_id`, so only the user-first direction needs its own index.

### `OrgMembershipFor` — one user, one org

A single-row membership read for the "does this specific user belong here" check,
again mapping `sql.ErrNoRows` to `ErrNotFound`. It scans inline rather than
reusing the list helper because it returns a value, not a slice.

### `scanOrgMemberships` — the shared list decoder

A small private helper taking a query and exactly one string argument, which is
all either listing needs. It closes rows with `defer`, converts the stored role
text to `organization.Role`, and returns `rows.Err()` so a mid-iteration failure
is not mistaken for a short list.

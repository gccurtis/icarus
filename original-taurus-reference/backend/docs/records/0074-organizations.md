# Organizations (Alpha gap G4b, sub-phase 4a)

Organizations are named entities that users belong to. They are one of the few
**above-Project** surfaces — a user↔organization link spans Projects, exactly
like a user's avatar or color, so it is a deliberate exception to the otherwise
absolute Project scoping. **An organization never grants Project access.** Its
only role in access control (sub-phase 4b) is to *narrow* who, among a Project's
existing members, may see a resource; the org-membership check is layered on top
of the unchanged Project gate, never in place of it.

## Capability: `core/capability/organization`

- **`Organization{ ID, Name, CreatedAt, UpdatedAt }`** — a named entity.
- **`Membership{ UserID, OrgID, Role }`** with **`Role`** ∈ `owner` / `admin` /
  `member`. Owner and admin may manage members and rename the org; **only an
  owner may grant or revoke the owner role**, and **the last owner can never be
  removed or demoted** (`ErrLastOwner`). A creator becomes the sole owner.
- **`Store`** port: `CreateOrganization` / `OrganizationByID` /
  `UpdateOrganization` and the membership methods **`AddOrgMembership` /
  `RemoveOrgMembership` / `SetOrgMembershipRole` / `OrgMembershipsByUser` /
  `OrgMembershipsByOrg` / `OrgMembershipFor`**. The membership methods carry the
  `Org` prefix because one `*sqlite.Store` implements every capability's store and
  the access capability already owns `AddMembership` / `RemoveMembership` for
  Project memberships. `MemoryStore` mirrors the SQLite semantics for tests.
- Service methods: `Create`, `Rename`, `ListMine` (orgs + the caller's role),
  `Members`, `AddMember`, `RemoveMember`, `SetRole`, and **`UserOrgIDs(userID)`** —
  the narrow query the resource access-scope resolver consults, which reveals no
  roles or other users' memberships.

## Persistence

`organizations(id, name, created_at, updated_at)` and
`org_memberships(org_id, user_id, role, PRIMARY KEY(org_id, user_id))` with an
index on `user_id` for the "my orgs" and access-resolver lookups.

## Endpoints (above-Project, on the signed-in `gated` group)

- `POST /organizations {name}` — create; caller becomes owner.
- `GET /organizations` — the caller's organizations, each with their role.
- `PATCH /organizations/:orgID {name}` — rename (owner/admin).
- `GET /organizations/:orgID/members` — list memberships (members only).
- `POST /organizations/:orgID/members {userId, role}` — add a member. Members are
  identified by user id; owner-role grants are owner-only.
- `PATCH /organizations/:orgID/members/:userID {role}` — change a role.
- `DELETE /organizations/:orgID/members/:userID` — remove a member.

Errors map to `403` (forbidden), `404` (not found), `409` (last owner), `400`
(invalid name/role). Registered only when `Options.Organizations` is set.

## Tests

- Unit (`core/capability/organization`): creator becomes owner and sees the org;
  blank name rejected; per-user isolation; only managers rename; admin manages
  members but only an owner mints an owner; last owner protected from removal and
  demotion; `Members` requires membership; `UserOrgIDs` returns the caller's orgs.
- Dev-test (`dev-test/organizations`, free): two users — owner creates an org,
  adds the second as a member, the member sees it as `member` but cannot rename it
  or mint an owner (403), the owner renames it, the last owner cannot be removed
  (409), the owner removes the member (204), and the removed member no longer sees
  the org.

## Settled

- Above-Project; org membership never grants Project access. ✓
- Roles owner/admin/member; last-owner protected; owner-only owner grants. ✓
- Members identified by user id (email-based add can layer on later). ✓
- `UserOrgIDs` is the seam for sub-phase 4b's access-scope resolver. ✓

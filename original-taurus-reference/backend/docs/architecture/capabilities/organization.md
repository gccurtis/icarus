# ORGANIZATION — above-project entities, and the visibility they narrow

ORGANIZATION owns **named entities that users belong to, independent of any one
project**, and the role-based memberships that connect them. An organization is
the unit a person means by "my team" — a grouping that outlives and spans the
projects it touches.

> **Organizations never grant project access.** This is the single most important
> thing to know about the capability. Membership in a *project* remains the sole
> authority for entering that project; an organization can only ever **narrow**
> who, among a project's existing members, may see a particular resource. Read
> the next section before assuming anything else.

A user↔organization link is one of the deliberate exceptions to Omega's otherwise
absolute project scoping (a user's avatar is another), precisely because an
organization spans projects. There is no `ProjectID` column anywhere in this
capability's schema, and no `Scope` parameter on any of its methods.

- **Domain and persistence contract** —
  [`core/capability/organization`](../../../core/capability/organization/organization.go).
  The `Organizations` service holds identity, membership, and role logic, and
  defines the `Store` it depends on.
- **In-memory store** —
  [`core/capability/organization/memory.go`](../../../core/capability/organization/memory.go).
- **Application handlers** —
  [`core/handlers/organization`](../../../core/handlers/organization/organization.go).

## Narrowing only — how orgs meet the access boundary

The [resource](resources/README.md) capability attaches an optional `AccessScope`
to a resource
([`core/capability/resource/access.go`](../../../core/capability/resource/access.go)):

```go
type AccessScope struct {
	ProjectWide bool
	OrgIDs      []string   // max 64
	UserIDs     []string   // max 256
}
```

A caller **who is already a project member** passes the scope when *any* of:
`ProjectWide` is true, they own the resource, their id is in `UserIDs`, or they
belong to one of `OrgIDs`. A nil scope means the project-wide default, so a
resource with no scope set behaves exactly as it did before access scopes existed.

The layering is what makes this safe. The [access](access.md) gate has *already*
re-checked project membership and stamped the authorized project onto the request
before any of this runs; the scope is a filter applied strictly *inside* that set.
Naming an org id in `OrgIDs` therefore selects "project members who are also in
that org" — it can never admit a non-member, however large the org. An
`AccessScope` with `ProjectWide=false` and empty lists is private to the owner;
normalizing a scope back to everyone stores it as nil, so the attribute table only
ever holds restrictions.

`UserOrgIDs(userID)` is the only method the resolver calls, and it is deliberately
narrow — it returns a sorted list of org ids and nothing else, never roles and
never another user's memberships. Wiring satisfies the port with
`resources.UseOrgMembership(organizations)`: `*organization.Organizations` already
matches `resource.OrgMembershipResolver` exactly, so **no adapter is needed**. A
nil resolver means an org-scoped resource simply admits nobody but its owner —
fail-closed.

## The model

```go
type Role string   // "owner" | "admin" | "member"

type Organization struct {
	ID, Name             string       // name trimmed, non-empty, ≤ 200 bytes
	CreatedAt, UpdatedAt time.Time
}

type Membership struct {
	UserID, OrgID string
	Role          Role
}

type MyOrganization struct {          // an org paired with the caller's role in it
	Organization Organization
	Role         Role
}
```

`Organizations` is **stateless over its `Store`** — the standard meta-model shape:
the struct holds only the store plus injectable `now`/`id` functions, and every
method is a pure function of its arguments and the store.

## Operations and the role rules

Authorization is not delegated to the transport here — there is no project scope
to gate on — so each method takes an `actorID` and checks the actor's own
membership first.

| Method | Rule |
|---|---|
| `Create(creatorID, name)` | Records the org and makes the creator its **sole owner**. |
| `Rename(actorID, orgID, name)` | Owner or admin. |
| `ListMine(userID)` | The caller's orgs with their role, sorted by name then id. An org that has vanished under a dangling membership is skipped, not an error. |
| `Members(actorID, orgID)` | **Any member** may list, sorted by user id. |
| `AddMember(actorID, orgID, userID, role)` | Owner or admin — but **only an owner may grant the owner role**. |
| `RemoveMember(actorID, orgID, userID)` | Owner or admin; an admin may not remove an owner; the **last owner is protected**. |
| `SetRole(actorID, orgID, userID, role)` | Owner or admin; **granting or revoking owner is owner-only**; the last owner cannot be demoted. |
| `UserOrgIDs(userID)` | The narrow query above. |

Two invariants are worth calling out. **An organization always keeps at least one
owner** — `ensureNotLastOwner` scans for another owner before any removal or
demotion, returning `ErrLastOwner` otherwise, so an org can never be orphaned into
an unmanageable state. And **non-membership is indistinguishable from
non-existence**: `membershipOf` translates the store's `ErrNotFound` into
`ErrForbidden`, so probing `/organizations/:orgID/members` cannot enumerate which
org ids exist.

## HTTP surface

All seven routes sit on the **gated** group — a signed-in user is required, but
deliberately *not* a selected project, because an organization spans projects.
They register only when an organization service is wired.

| Method & path | Handler | Purpose |
|---|---|---|
| `POST /organizations` | `Create` | Create an org owned by the caller. → `201` |
| `GET /organizations` | `List` | The caller's organizations with their role. |
| `PATCH /organizations/:orgID` | `Rename` | Rename (owner/admin). |
| `GET /organizations/:orgID/members` | `Members` | List memberships (members only). |
| `POST /organizations/:orgID/members` | `AddMember` | Add `{userId, role}`. → `201` |
| `PATCH /organizations/:orgID/members/:userID` | `SetRole` | Change a member's role. → `204` |
| `DELETE /organizations/:orgID/members/:userID` | `RemoveMember` | Remove a member. → `204` |

Error mapping: invalid name / invalid role / blank user → `400`, not permitted →
`403`, not found → `404`, last owner → `409`.

## Persistence

Two tables in the one SQLite [store](../persistence.md) — and note the absence of
`project_id` from both, which *is* the design. **`organizations`** is keyed by
`id` with name and timestamps; **`org_memberships`** is keyed `(org_id, user_id)`
with a role, a foreign key to `organizations`, and `idx_org_memberships_user` for
the `UserOrgIDs` lookup on the resource read path. A `MemoryStore` provides the
same contract for unit tests.

## Status

**Wired and reachable over HTTP today.** `wiring.Run` builds the service over the
shared store, injects it into the resource catalog as the org-membership resolver,
and hands it to the transport for the seven gated routes.

## Related

- [Access](access.md) — project membership, the authority organizations never override.
- [Resources](resources/README.md) — the access scopes that consume org membership.
- [Persistence](../persistence.md) — the `organizations` / `org_memberships` schema.

---
title: "Model — Identity, Organization, Project Ownership & Access"
notion_page_id: "3acb6410e5028106b617d05f162b5ddf"
notion_url: "https://app.notion.com/3acb6410e5028106b617d05f162b5ddf"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 22:17:17Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Model — Identity, Organization, Project Ownership & Access

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

Status: Primary specification  
Scope: Taurus Enterprise Control Plane authority model, Taurus Alpha implications, and User Cell / Project Subcell admission  
Architecture authorities: [Taurus Layered Application Model](https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f), [Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22), and [User Cell & Project Subcell Runtime](https://app.notion.com/p/3acb6410e5028147909ef7214406baad)  
Companions: “Settings — User & Project” and “Experience — Organization Administration”
## Purpose
This model answers four questions that must remain separate:
1. **Who signed in?** — a User and one of their authentication methods.
2. **Who owns this project?** — exactly one User or Organization.
3. **Who may act on this project?** — explicit grants to Users or Organizations.
4. **Which commercial and administrative rules apply?** — a plan and policies attached to the owning User or root Organization.
Keeping those questions separate prevents several dangerous shortcuts. An organization administrator does not automatically gain permission to read every project. A project editor cannot take ownership. Removing a person from a team does not leave the project ownerless. Changing a plan does not rewrite membership.
A fifth question belongs at the boundary rather than inside any resource capability: **may this authenticated User execute this named action in this explicit Project now?** The control plane answers it with a bounded Project admission context. Omega then acquires the authenticated User's User Cell and that User's `(UserID, ProjectID)` Project Subcell to execute the request. This page owns the authority decision; it does not own Document, Workspace, Knowledge, or other Project content.
## The model at a glance
```plain text
User ── authenticates through ── Credential / External Identity
  │
  ├── belongs directly to ── Organization nodes
  │                            │
  │                            └── form one rooted organization tree
  │
  └── may receive ─────────── Project Grants

Project ── has exactly one ── OwnerRef(User | Organization)
  │
  ├── grants access to ───── PrincipalRef(User | Organization)
  └── derives plan from ──── owning User or root Organization
```
The most important distinction is:
> Ownership answers who is ultimately responsible for the project. Grants answer who may currently use or administer it.
## 1. Users are people, not tenants
A `User` represents one human identity in Taurus. It is the subject recorded in audit events and the identity attached to a session.
```go
type User struct {
    ID          UserID
    Email       string
    DisplayName string
    AvatarURL   string
    Status      UserStatus // active, suspended, deactivated
    CreatedAt   time.Time
    UpdatedAt   time.Time
}
```
Credentials do not live directly on the User record. A User may authenticate through:
- a Taurus password;
- an enterprise OIDC or SAML identity;
- another verified external identity in the future.
This separation permits an enterprise to disable password login without deleting the User, and permits a person to retain one stable identity while their sign-in method changes.
There is no shared “organization login.” Every administrator signs in as an individual User. Their organization role authorizes the management action, and the audit log records the actual person who performed it. Machine access, if added later, uses a distinct service-account principal rather than impersonating an organization.
### Account security operations
Omega must support:
- change password after verifying the current password or a recent step-up;
- non-enumerating password recovery with a single-use, expiring token;
- revoking one session, all other sessions, or all sessions;
- listing active sessions/devices at a privacy-appropriate level;
- linking and unlinking approved external identities;
- disabling password operations when authentication is enterprise-managed;
- suspending an account without destroying its authorship or audit history.
For password-authenticated accounts, policy should follow current NIST guidance: allow long passwords, use a minimum of 15 characters for password-only authentication, permit at least 64 characters, avoid arbitrary composition rules and periodic forced rotation, and reject known-compromised values.
## 2. Organizations form a rooted tree
An Organization is an administrative ownership principal. The top node is the tenant boundary; child nodes represent divisions, departments, teams, or other ownership units.
```go
type Organization struct {
    ID                   OrganizationID
    RootOrganizationID   OrganizationID
    ParentOrganizationID *OrganizationID
    Kind                 OrganizationKind // root, unit
    Name                 string
    Slug                 string
    Status               OrganizationStatus
    Version              uint64
    CreatedAt            time.Time
    UpdatedAt            time.Time
}
```
Example:
```plain text
Acme Corporation                    root organization
├── Research                        organization unit
│   ├── Applied AI                  organization unit
│   └── Knowledge Systems           organization unit
└── Customer Operations             organization unit
```
The root Organization owns tenant-wide concerns:
- verified domains and enterprise identity configuration;
- plan, billing, and usage;
- default security and retention policy;
- provisioning and deprovisioning;
- organization-wide audit access.
A child Organization can own projects and receive project access. This gives teams durable ownership without making every team a separate billing or SSO tenant.
### Tree invariants
- A root has no parent and its `RootOrganizationID` is its own ID.
- A unit has exactly one parent within the same root.
- Cycles are impossible.
- A unit cannot be moved between roots in V1.
- Deactivating a unit never silently deletes its projects.
- A project owned by a unit remains within the root tenant’s administrative boundary.
This specification intentionally supports one managed root Organization per User. A managed User may belong directly to several units beneath that root. External collaborators can receive direct Project grants without becoming members of the owner’s Organization.
## 3. Organization membership is direct; inheritance is computed
Omega stores direct memberships:
```go
type OrganizationMembership struct {
    OrganizationID OrganizationID
    UserID         UserID
    Role           OrganizationRole // owner, admin, member
    Status         MembershipStatus
    JoinedAt       time.Time
}
```
Membership in a child unit implies membership in its ancestors for navigation and policy application, but Omega does not materialize a duplicate row at every level. The authorization resolver computes inherited relationships from the tree.
The initial role vocabulary is deliberately small:
- `owner` — ultimate root administration, including other administrators and ownership-sensitive operations;
- `admin` — delegated organization management within the permitted scope;
- `member` — ordinary membership without administrative power.
Code should still authorize named actions rather than scattering role comparisons:
```go
Authorize(actor, "organization.member.remove", organization)
Authorize(actor, "project.ownership.transfer", project)
```
This lets policy become more granular later without rewriting every handler.
## 4. Every Project has exactly one owner
```go
type OwnerRef struct {
    Kind PrincipalKind // user, organization
    ID   string
}

type Project struct {
    ID                 ProjectID
    Owner              OwnerRef
    RootOrganizationID *OrganizationID // nil only for a User-owned Project
    Name               string
    Icon               string
    Purpose            string
    Status             ProjectStatus
    Version            uint64
    CreatedAt          time.Time
    UpdatedAt          time.Time
}
```
A User-owned project behaves like a personal workspace. An Organization-owned project belongs durably to the root or unit even when individual employees leave.
“Owner” is no longer a membership role. The current Omega model permits multiple project members with the `owner` role, which makes transfer, deletion, and enterprise custody ambiguous. The new model makes ownership a single project field and makes project roles grants.
When a User creates an Organization-owned project:
1. the chosen Organization becomes the `OwnerRef`;
2. the Project records the Organization's root boundary;
3. the creator receives a direct `manager` grant;
4. no other member receives content access unless an Organization or User grant is explicitly created.
### Project admission and execution boundary
A Project is a durable directory/authority record in the control plane. It is not a process, session, browser tab, or User cell. To open or mutate it, the edge asks the control plane for a fresh admission:
```go
type ProjectAccessContext struct {
    SubjectUserID   UserID
    ActingPrincipal PrincipalRef
    ProjectID       ProjectID
    Owner           OwnerRef
    EffectiveRole   ProjectRole
    AccessPath      []AccessPathStep
    Entitlements    EntitlementSnapshot
    PolicyVersion   string
    AccessEpoch     uint64
    SessionID       string
    ExpiresAt       time.Time
}
```
The context is an in-process typed value in a modular monolith and may become a short-lived signed assertion across a future service boundary. The Project Subcell verifies that its fixed `UserID` and `ProjectID`, the route `ProjectID`, and the admission context all agree before calling a capability. Project capabilities therefore receive current authority without importing identity, Organization, billing, or plan storage.
## 5. Project access uses grants to principals
```go
type PrincipalRef struct {
    Kind PrincipalKind // user, organization
    ID   string
}

type ProjectGrant struct {
    ID        ProjectGrantID
    ProjectID ProjectID
    Principal PrincipalRef
    Role      ProjectRole // manager, editor, viewer
    Status    GrantStatus
    CreatedBy UserID
    CreatedAt time.Time
}
```
Roles mean:
<table header-row="true">
<tr>
<td>Role</td>
<td>Content</td>
<td>Project settings</td>
<td>Grants</td>
<td>Ownership</td>
</tr>
<tr>
<td>Viewer</td>
<td>Read</td>
<td>Read limited metadata</td>
<td>No</td>
<td>No</td>
</tr>
<tr>
<td>Editor</td>
<td>Read and edit</td>
<td>Read limited metadata</td>
<td>No</td>
<td>No</td>
</tr>
<tr>
<td>Manager</td>
<td>Read and edit</td>
<td>Manage ordinary settings</td>
<td>Manage grants and links</td>
<td>Cannot take or transfer ownership</td>
</tr>
</table>
An Organization grant applies to Users who are active members of that node or its descendants. A grant to a child unit does not include its parent or siblings.
If several active grants apply, the effective project role is the strongest one. V1 does not include deny grants; explicit denies combined with inheritance create difficult-to-explain access paths. Revocation removes the relevant grant.
Organization membership alone does **not** grant project content access. Similarly, an Organization administrator may manage custody and grants for an Organization-owned project without automatically receiving permission to open its contents. If that administrator needs content access, they or their Organization must receive a project grant.
Direct User grants support external collaborators. Removing a User from an Organization immediately removes inherited Organization grants, but any independent direct Project grant remains visible and must be reviewed or revoked separately.
Every admission decision returns an explainable effective role and access path. It is short-lived and keyed by an access epoch and policy version. Membership, grant, ownership, User-status, or policy changes invalidate cached decisions and live Project access. A long-running job or high-risk mutation reauthorizes before protected work; it never relies indefinitely on a stale session or plan snapshot.
## 6. Invitations and sharing links are ways to create access
Invitations and sharing links are not themselves durable ownership.
- An invitation names an intended User or email, the requested role, expiry, inviter, and target Project or Organization.
- Accepting a Project invitation creates a Project grant.
- Accepting an Organization invitation creates direct Organization membership.
- A sharing link authorizes only the bounded role and expiry encoded by its server-side record.
- Revoking a link prevents future use but does not silently remove grants that were explicitly converted from it unless the product states that relationship.
High-risk enterprise policies may disable public links, require verified domains, or cap the role that a link can provide.
## 7. Ownership transfer is an accepted transition
Ownership transfer must never be implemented as a blind `owner_id` update.
```go
type OwnershipTransfer struct {
    ID           OwnershipTransferID
    ProjectID    ProjectID
    From         OwnerRef
    To           OwnerRef
    Status       TransferStatus // pending, accepted, declined, expired, cancelled
    InitiatedBy  UserID
    ExpiresAt    time.Time
    AcceptedBy   *UserID
    CreatedAt    time.Time
    CompletedAt  *time.Time
}
```
The current owner remains authoritative until acceptance. Both initiation and acceptance are audited and require recent authentication for sensitive cases.
V1 supports:
- User → User;
- User → Organization, accepted by an authorized Organization administrator;
- Organization → User;
- Organization → Organization within the same root.
Cross-root Organization transfer is excluded from V1 because it changes tenant, policy, encryption, retention, and billing boundaries. That operation should be a deliberate migration or copy workflow.
The transition verifies that:
- the actor may transfer the current owner’s property;
- the target exists and may own projects;
- the target accepts;
- at least one manager remains after transfer;
- pending destructive operations do not race the transfer;
- the audit event contains before/after ownership and the accepting human.
## 8. Plans and entitlements are separate from identity
A plan is not a boolean field on User or Organization:
```go
type PlanAssignment struct {
    SubjectKind PrincipalKind // user or root organization
    SubjectID   string
    PlanCode    string
    Status      PlanStatus
    StartsAt    time.Time
    EndsAt      *time.Time
    Version     uint64
}
```
`PlanCode` is opaque product configuration. This model does not prematurely define commercial tiers.
A Project’s effective plan is derived:
- User-owned Project → owning User’s active plan;
- Organization-owned Project → root Organization’s active plan.
The effective entitlement resolver combines that plan with administrative policy. A personal plan never overrides an enterprise restriction. Storing this model now allows future limits and billing without mixing them into access control today.
## 9. Capability boundaries inside Omega
The target responsibilities are:
<table header-row="true">
<tr>
<td>Capability</td>
<td>Owns</td>
</tr>
<tr>
<td>Identity</td>
<td>Users, credentials, external identities, recovery tokens, sessions</td>
</tr>
<tr>
<td>Organization</td>
<td>Organization tree, direct memberships, delegated administration, policy references</td>
</tr>
<tr>
<td>Project Access</td>
<td>Projects, OwnerRef, grants, invitations, links, ownership transfers</td>
</tr>
<tr>
<td>Entitlement</td>
<td>Plan assignments, effective entitlements, usage references</td>
</tr>
<tr>
<td>Audit</td>
<td>Append-only security and administrative events</td>
</tr>
</table>
These are control-plane capabilities. They communicate through narrow ports assembled in wiring. For example, Project Access may ask an `OrganizationAuthorityPort` whether an actor can accept ownership for a unit. It should not import Organization storage or reach into its tables.
A User Cell is the runtime root for one `UserID`; within it, each Project Subcell is the user-bound execution boundary for one `(UserID, ProjectID)`. It may use a small `ProjectAuthorityPort` at admission and reauthorization boundaries, but it never reads control-plane stores directly. The control plane likewise never reads Project resource tables merely to decide ownership, grants, plan, or policy. This preserves the split when the modules later become separately deployed roles.
Every mutating service:
1. authenticates the session;
2. resolves the actor and current resource version;
3. authorizes a named action using current membership, grants, ownership, and policy;
4. validates invariants;
5. commits the state transition transactionally;
6. appends an audit event and durable outbox event;
7. returns the new version.
Handlers must not rely on Alpha to hide prohibited controls. Alpha’s permission-shaped UI is convenience; Omega remains authoritative.
## 10. Storage shape
The exact DDL belongs in the implementation plan, but the canonical tables are:
- `users`
- `credentials`
- `external_identities`
- `sessions`
- `password_recovery_tokens`
- `organizations`
- `organization_closure` (derived ancestry projection)
- `organization_memberships`
- `projects`
- `project_grants`
- `organization_invitations`
- `project_invitations`
- `project_share_links`
- `project_ownership_transfers`
- `plan_assignments`
- `entitlement_usage`
- `library_assets`
- `library_asset_grants`
- `library_lineage`
- `library_usage`
- `audit_events`
- `outbox_events`
Personality, Context, and Template originals are User-level control-plane assets in V1. They may be shared to Users or Organizations, then materialized as independent Project copies through ordinary Project capability operations. Organization grants never turn an Organization into a login account or give an administrator an implicit right to inspect a user's library original.
Authoritative and security-relevant records use status changes or tombstones rather than destructive deletion during their retention period.
## 11. Authorization examples
### A team owns a project
Applied AI owns “Research Briefs.” Alice and Ben are members of Applied AI. The project has an `organization:Applied AI → editor` grant. Both can edit. Cara is an Acme root administrator but has no content grant; she can see the project in the administrative inventory and manage custody, but cannot open the document.
### An external consultant
Diego is not an Acme member. He has a direct `user:Diego → viewer` grant. Removing Alice from Applied AI removes Alice’s inherited editor access; it does not affect Diego.
### A person leaves
The Organization suspends Alice’s User membership. Her sessions are revoked and inherited access disappears. Projects owned by Applied AI remain owned by Applied AI. Audit history continues to name Alice as the actor of her prior changes.
## 12. Migration from current Omega
Current Omega has flat Organizations, User-only Project memberships, Project `owner/edit/read` roles, and no project ownership principal or plan assignment.
The safe pre-release migration is:
1. Convert each existing Organization into a root node.
2. Preserve existing memberships as direct root memberships.
3. Add `OwnerRef` to every Project.
4. If a Project has exactly one current owner member, use that User as the initial owner and convert their access to `manager`.
5. Refuse ambiguous multiple-owner rows into a migration report; resolve them explicitly before cutover rather than silently choosing custody.
6. Convert `edit` and `read` memberships into direct User grants.
7. Seed configured default PlanAssignments without embedding product tier logic in the migration.
8. Migrate the authoritative session model from selected-Project authorization to explicit Project admission. A last-opened Project may remain as User navigation preference only.
9. Introduce the in-process User Cell registry after admission is stable; User Cells are keyed by `UserID`, each contains Project Subcells keyed by `ProjectID`, and the resulting global subcell identity is `(UserID, ProjectID)`.
10. Keep old records parked until the rollback window closes.
## 13. Acceptance criteria
- Every Project has exactly one valid User or Organization owner.
- Ownership and content access are independently testable.
- A root Organization can contain nested units without cycles.
- Unit-owned Projects survive member and administrator turnover.
- Organization administrators do not gain implicit content access.
- Direct and inherited Project grants produce an explainable access path.
- Password, SSO-managed, recovery, and session-revocation flows are represented.
- Ownership transfer is pending, accepted, versioned, and audited.
- User- and Organization-owned Projects resolve a plan deterministically.
- Every high-risk mutation is reauthorized in Omega and records the human actor.
- A session authenticates a User but does not by itself authorize a Project; every Project route is explicit and admitted.
- A User Cell and its admitted Project Subcell receive bounded authority context and cannot query control-plane tables directly.
- User-level libraries remain available without Project selection and materialize into Project copies through separately authorized operations.
## Sources
- Taurus Omega current Identity model: [https://github.com/gccurtis/taurus-omega/blob/main/core/capability/access/access.go](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/access/access.go)
- Taurus Omega current Project access model: [https://github.com/gccurtis/taurus-omega/blob/main/core/capability/access/project.go](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/access/project.go)
- Taurus Omega current Organization model: [https://github.com/gccurtis/taurus-omega/blob/main/core/capability/organization/organization.go](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/organization/organization.go)
- NIST SP 800-63B, authentication and password guidance: [https://pages.nist.gov/800-63-4/sp800-63b/authenticators/](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/)
- OWASP Forgot Password guidance: [https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- SCIM Core Schema, including User and Group membership: [https://datatracker.ietf.org/doc/html/rfc7643](https://datatracker.ietf.org/doc/html/rfc7643)
- SCIM Protocol: [https://datatracker.ietf.org/doc/html/rfc7644](https://datatracker.ietf.org/doc/html/rfc7644)
## Related specifications
- [Architecture — Taurus Layered Application Model](https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f)
- [Architecture — Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22)
- [Architecture — User Cell & Project Subcell Runtime](https://app.notion.com/p/3acb6410e5028147909ef7214406baad)
- [Deployment — Taurus Topology & Scaling Model](https://app.notion.com/p/3acb6410e502816585d9e96ff02921d8)
- [Implementation — Control Plane, User Cell & Project Subcell Integration](https://app.notion.com/p/3acb6410e50281b2999bce58d559d902)
- [Settings — User & Project](https://app.notion.com/p/3acb6410e5028122ab96eed1434bb897)
- [Experience — Organization Administration](https://app.notion.com/p/3acb6410e502815c8782cb126c93b787)


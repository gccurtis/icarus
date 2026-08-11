---
title: "Experience — Organization Administration"
notion_page_id: "3acb6410e502815c8782cb126c93b787"
notion_url: "https://app.notion.com/3acb6410e502815c8782cb126c93b787"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 22:17:17Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Experience — Organization Administration

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

Status: Supporting specification  
Scope: Taurus Alpha Organization-administration surface backed by the Taurus Enterprise Control Plane  
Authorities: [Model — Identity, Organization, Project Ownership & Access](https://app.notion.com/p/3acb6410e5028106b617d05f162b5ddf), [Architecture — Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22), and [Architecture — Taurus Layered Application Model](https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f)
## Purpose
The Organization Administration experience gives authorized people one place to manage:
- the Organization tree;
- people and administrative roles;
- Organization-owned Projects and their access;
- identity and security policy;
- plan, usage, and billing;
- audit, compliance, and destructive operations.
It is a focused management console, not a second content application. It may use several routes for clarity, but all routes share one Organization-scoped shell.
The console is a control-plane surface. It reads and mutates Organization, User, Project-directory, grant, policy, plan, and audit records. It does not open, host, or directly inspect a Project Subcell merely because an administrator is reviewing a Project's custody. Opening Project content is a separate admission flow through the authenticating User's User Cell and `(UserID, ProjectID)` subcell.
## Authentication rule
An Organization does not have a username and password.
An administrator signs in as their own User, enters:
```plain text
/admin/organizations/{rootOrganizationID}/...
```
and acts through an Organization role. Sensitive operations require recent authentication or step-up. Every audit record names the human User.
This avoids shared credentials, makes offboarding reliable, supports SSO/MFA, and preserves accountability. Future service accounts are separate non-human principals with limited scopes.
The signed-in User is the authentication subject. When permitted, they act through a named Organization Principal for administration. That acting context is recorded in audit, but it does not silently convert into Project content access. Administrative routes are User/Organization-scoped; Project routes remain explicit and separately admitted.
## Console navigation
Recommended route families:
```plain text
Overview
People
Organization
Projects
Access reviews
Security & identity
Plan & usage
Audit
Danger
```
Navigation is permission-shaped. A unit administrator may enter the same console scoped to their unit but cannot see root-only billing or identity configuration.
## 1. Overview
The landing page answers:
- How many active, invited, suspended, and external Users exist?
- How many units and Organization-owned Projects exist?
- Are there failed provisioning, identity, connector, or policy operations?
- Are any Projects ownerless, transfer-pending, externally shared, or scheduled for deletion?
- Are plan limits or security reviews approaching?
This is operational orientation, not an analytics dashboard. Each card links to the authoritative list that can explain and resolve the state.
## 2. People
The people directory shows:
- User identity and status;
- direct root and unit memberships;
- Organization role and delegated admin scope;
- provisioning source: manual, invitation, or SCIM;
- last activity at an appropriate privacy granularity;
- number of directly and indirectly accessible Projects;
- external-collaborator status.
Authorized actions:
- invite a User;
- resend or cancel an invitation;
- add or remove direct unit membership;
- promote or demote an Organization role;
- delegate administration over a unit;
- suspend or reactivate a User;
- revoke sessions;
- remove a User from the Organization;
- inspect the access and custody impact before removal.
### Offboarding preview
Before suspension or removal, Omega calculates:
- Projects the User owns;
- Projects they manage;
- direct Project grants;
- inherited Organization grants;
- pending ownership transfers;
- active sessions, tokens, and connector credentials;
- scheduled jobs attributed to their identity.
The console requires custody resolution for User-owned Projects. Organization-owned Projects do not need transfer simply because an employee leaves.
## 3. Organization structure
This route renders the root and nested units as a tree and a searchable list.
Authorized actions:
- create a unit;
- rename a unit;
- assign or change its parent within the root;
- delegate a unit administrator;
- deactivate or reactivate a unit;
- inspect directly owned Projects and member counts.
Before moving or deactivating a unit, Omega previews:
- affected membership inheritance;
- Organization grants whose effective audience changes;
- owned Projects;
- policies inherited from ancestors;
- administrators who would lose scope.
V1 does not move a unit across root Organizations. Deactivating a unit requires transferring or explicitly parking its owned Projects.
## 4. Projects
This is an administrative inventory of Projects owned by the root or its units. It includes:
- Project name and status;
- direct owner node;
- responsible managers;
- effective plan source;
- direct and inherited grant counts;
- external Users and public links;
- pending transfer, archive, or deletion;
- last administrative activity.
An Organization administrator with the correct action may:
- change ordinary Project metadata;
- grant or revoke User or Organization access;
- expire invitations and links;
- transfer ownership within the root;
- initiate transfer to a User;
- archive, restore, or schedule deletion;
- export an access report.
Administrative visibility does not equal content visibility. The console may show Project metadata, custody, entitlement source, and access records without allowing the administrator to open resources inside the Project. “Open Project” appears only when the User also has current content access.
When selected, “Open Project” navigates Alpha to the explicit `/projects/{projectID}` route. The edge obtains a new Project access context and the Project router reuses or activates that Project's cell. Browsing the administrative inventory alone therefore cannot create a hidden content session, alter another Project selection, or reveal resource names.
## 5. Access reviews
The review surface answers:
- Who can access this Project?
- Why do they have access?
- Which access is direct, inherited, external, or link-derived?
- Which grants are stale, unusually powerful, or unused?
- Which Projects are shared outside the root Organization?
Filters:
- Project;
- User;
- unit;
- role;
- direct or inherited;
- internal or external;
- link-based;
- last used;
- pending or expired.
Bulk operations are limited to homogeneous, previewable changes. Omega evaluates every target independently, returns partial refusal reasons, and writes one parent audit event plus target events. The console never hides a failed revocation inside an optimistic bulk success.
## 6. Security and identity
Root Organization owners and authorized security administrators manage:
- verified domains;
- OIDC/SAML configuration;
- SCIM provisioning credentials and status;
- authentication policy;
- session lifetime;
- multifactor requirements;
- public-link policy;
- external collaboration policy;
- retention and export policy references;
- User-library sharing and Project-capture export-governance policy references;
- security contacts.
User-level Personality, Context, and Template libraries remain owned by individual Users in V1. Organization administration governs applicable sharing, export, classification, and retention policy; it does not make an Organization the shared login or automatically expose individual library originals to every administrator.
Configuration follows draft → validate → activate where a mistake could lock out the Organization. Identity-provider changes preserve at least one tested administrative recovery path.
Secrets are write-only. Alpha receives metadata, status, last rotation, and validation results—not secret material.
SCIM should model Users and groups/units through the standard protocol, but Omega remains the source of authorization truth. Provisioning creates, updates, suspends, and assigns direct memberships; it does not bypass Project-grant rules.
## 7. Plan, usage, and billing
Show:
- active Organization plan and status;
- billing contact and provider-management link;
- seat assignment and counts;
- storage, knowledge indexing, model, export, and connector usage as supported;
- current limits and warning thresholds;
- invoices or billing history when Taurus owns that surface.
Plans attach to the root Organization. Units and their Projects inherit entitlements. A future budget or allocation policy may subdivide usage, but a child unit is not a second tenant subscription.
The control plane resolves a short-lived, versioned `EntitlementSnapshot` when a User opens or performs work in a Project. Admitted Project Subcells and resource capabilities consume that bounded result; they do not query billing, plan, or Organization stores directly. Billing mutations and product entitlement checks remain separate services. Payment-provider identifiers do not become authorization roles.
## 8. Audit
Authorized administrators can search and export:
- membership and role changes;
- Project grants and ownership transfers;
- sign-in, recovery, and session-revocation events;
- identity and policy changes;
- plan and billing administration;
- exports, archives, restores, and deletions;
- connector authorization and revocation.
Every entry includes actor, action, target, time, scope, result, and a safe before/after summary. Audit access itself is audited. Content bodies, passwords, tokens, and secret assertions are excluded.
## 9. Danger
High-risk operations include:
- transfer root ownership;
- deactivate a unit with owned Projects;
- remove a verified domain or identity provider;
- disable provisioning;
- schedule root Organization deletion;
- cancel destructive operations during the recovery window.
These actions require:
1. named permission;
2. recent authentication or step-up;
3. an impact preview;
4. typed or equivalent explicit confirmation;
5. optimistic concurrency/version validation;
6. audit and durable outbox delivery;
7. a recovery window when recovery is technically possible.
Root deletion is blocked while custody, retention, legal hold, billing, or migration requirements remain unresolved.
## 10. Permission model
The initial Organization roles remain `owner`, `admin`, and `member`, but the console is authorized by actions:
```plain text
organization.settings.read
organization.structure.manage
organization.member.invite
organization.member.remove
organization.role.manage
organization.identity.manage
organization.policy.manage
organization.plan.read
organization.billing.manage
organization.audit.read

project.inventory.read
project.grant.manage_as_owner
project.ownership.transfer
project.archive_as_owner
project.delete_as_owner
```
Root owners can delegate bounded administration later without changing resource schemas. Unit administrators receive a subtree scope, not tenant-wide authority.
## 11. Control-plane API shape
All Organization-administration routes are authenticated User/Organization control-plane routes. They never require a server-side selected Project and do not activate a Project Subcell as a side effect. The Project inventory returns caller-filtered administrative projections, not raw resource contents.
Representative reads:
```plain text
GET /organizations/{id}/admin/overview
GET /organizations/{id}/people
GET /organizations/{id}/tree
GET /organizations/{id}/projects
GET /organizations/{id}/access-review
GET /organizations/{id}/security
GET /organizations/{id}/plan
GET /organizations/{id}/audit
```
Representative mutations:
```plain text
POST /organizations/{id}/invitations
POST /organizations/{id}/units
POST /organizations/{id}/members/{user_id}/suspend
POST /organizations/{id}/members/{user_id}/remove-preview
POST /organizations/{id}/members/{user_id}/remove
POST /projects/{id}/grants
POST /projects/{id}/ownership-transfers
POST /organizations/{id}/identity-configurations/validate
POST /organizations/{id}/identity-configurations/activate
```
The exact transport can differ, but previewable destructive changes, expected versions, stable error codes, and permission explanations are required.
A content-opening route remains separate:
```plain text
GET /projects/{projectID}/...
→ authenticate User
→ control plane authorizes current Project access
→ runtime acquires UserCell(UserID)
→ User Cell acquires ProjectSubcell(UserID, ProjectID)
→ Project Subcell executes scoped capability request
```
The administration console never receives a runtime host/affinity token or direct resource-store credential.
## 12. Alpha experience rules
- Keep navigation shallow and lists searchable.
- Show the current administrative scope at all times.
- Distinguish metadata administration from permission to open content.
- Explain inherited access with its path.
- Label fields managed by identity provider, policy, or billing system.
- Require previews for actions whose effects span Users, units, or Projects.
- Preserve filters and list position after a mutation.
- Treat partial bulk failure as a first-class result.
- Treat “Open Project” as a transition into a separately authorized Project workspace, not an expansion of the administration surface.
- Never imply content access from Organization administration, plan visibility, Project ownership, or a library-sharing policy.
- Meet keyboard, screen-reader, contrast, focus, and reduced-motion requirements.
## 13. Acceptance criteria
- No shared Organization credential exists.
- Every administrative action identifies a human actor.
- Root and unit administrators see only their authorized scope.
- People can be provisioned, suspended, removed, and assigned to units.
- Offboarding cannot orphan User-owned Projects.
- Organization-owned Projects are centrally discoverable and manageable.
- Administrative access does not imply Project content access.
- Direct, inherited, external, and link access are explainable.
- Security, plan, usage, and audit surfaces have authoritative Omega reads.
- High-risk changes require step-up, preview, version checks, and audit.
- Reviewing Organization or Project-directory records never activates a Project Subcell or grants content access.
- Organization policy can govern user-library sharing and Project-capture export without exposing individual User-owned library originals.
- An explicitly opened Project obtains fresh admission and is routed to its Project-keyed cell.
## Sources
- Model — Identity, Organization, Project Ownership & Access
- Settings — User & Project
- Taurus Omega current Organization model: [https://github.com/gccurtis/taurus-omega/blob/main/core/capability/organization/organization.go](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/organization/organization.go)
- SCIM Core Schema: [https://datatracker.ietf.org/doc/html/rfc7643](https://datatracker.ietf.org/doc/html/rfc7643)
- SCIM Protocol: [https://datatracker.ietf.org/doc/html/rfc7644](https://datatracker.ietf.org/doc/html/rfc7644)
## Related specifications
- [Model — Identity, Organization, Project Ownership & Access](https://app.notion.com/p/3acb6410e5028106b617d05f162b5ddf)
- [Architecture — Taurus Layered Application Model](https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f)
- [Architecture — Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22)
- [Architecture — User Cell & Project Subcell Runtime](https://app.notion.com/p/3acb6410e5028147909ef7214406baad)
- [Deployment — Taurus Topology & Scaling Model](https://app.notion.com/p/3acb6410e502816585d9e96ff02921d8)
- [Implementation — Control Plane, User Cell & Project Subcell Integration](https://app.notion.com/p/3acb6410e50281b2999bce58d559d902)
- [Settings — User & Project](https://app.notion.com/p/3acb6410e5028122ab96eed1434bb897)


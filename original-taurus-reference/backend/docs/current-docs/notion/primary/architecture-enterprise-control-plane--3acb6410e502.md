---
title: "Architecture — Enterprise Control Plane"
notion_page_id: "3acb6410e50281988386c4559a26cd22"
notion_url: "https://app.notion.com/3acb6410e50281988386c4559a26cd22"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 22:22:55Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Architecture — Enterprise Control Plane

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🛂" color="purple_bg">
	**Frozen-baseline boundary clarification.** The enterprise/control plane admits a User and Project operation and resolves organization/entitlement policy; it does not own Project capability state. Every Project request names Project explicitly and receives fresh admission. User-level library/control routes may bypass Project selection while still carrying User/Organization authority. The execution plane consumes a narrow admission/entitlement snapshot and remains unchanged when license packaging evolves.
</callout>
<callout icon="🛡️" color="blue_bg">
	**Control-plane boundary:** authenticate the User, resolve current enterprise authority, admit a named Project action, and return a bounded access context. Runtime placement is user-oriented and optional; authorization never depends on cell existence or placement.
</callout>
## Responsibilities
The Enterprise Control Plane owns:
- User identity, credentials, sessions, MFA, and recovery;
- Organization hierarchy, membership, delegated administration, and policy;
- Project ownership, grants, roles, and discovery;
- licenses, entitlements, quotas, and access epochs;
- user and organization settings whose meaning is enterprise-wide;
- audit events for identity, ownership, grants, policy, license, and administration;
- fresh admission for every Project action.
It does not own Project resource behavior, Workspace reducers, Knowledge lattices, conversions, formulas, slide edits, chat turns, or document history.
## Principal model
```go
type PrincipalKind string

const (
    PrincipalUser         PrincipalKind = "user"
    PrincipalOrganization PrincipalKind = "organization"
    PrincipalSystem       PrincipalKind = "system"
)

type PrincipalRef struct {
    Kind PrincipalKind
    ID   string
}
```
- A User authenticates.
- An Organization may own a Project, receive a grant, contain other Organizations, and delegate administration.
- An Organization is never a shared login.
- Administration does not imply Project content access.
- System work uses an explicit System principal with bounded policy.
## Admission contract
```go
type ProjectAdmissionRequest struct {
    SubjectUserID UserID
    ProjectID     ProjectID
    Action        Action
    RequestID     string
    SessionID     SessionID
}

type ProjectAdmission struct {
    SubjectUserID     UserID
    ProjectID         ProjectID
    Action            Action
    EffectiveRole     Role
    AccessPaths       []AccessPath
    AccessEpoch       int64
    PolicyVersion     int64
    Entitlements      EntitlementSet
    RateLimitClass    string
    AdmittedAt        time.Time
}

type AdmissionPort interface {
    Admit(ctx context.Context, req ProjectAdmissionRequest) (ProjectAdmission, error)
    Reauthorize(ctx context.Context, prior ProjectAdmission) (ProjectAdmission, error)
}
```
There is no `ProjectPlacement`, `ProjectGeneration`, or Project activation lease in this contract. After admission, the application may acquire `UserCell(SubjectUserID)` and `ProjectSubcell(SubjectUserID, ProjectID)`. That acquisition is execution plumbing, not authority.
## Request flow
```plain text
request
  → authenticate session as User
  → parse explicit ProjectID + Action
  → admit against current ownership/grants/policy/license/access epoch
  → acquire User Cell
  → acquire that User's Project Subcell
  → call capability with bounded ProjectScope
  → commit revision/change/outbox atomically
  → return authoritative result
```
Long-running jobs persist the actor, action, access epoch, and bounded input references. They reauthorize before publishing an externally visible result.
## Data separation
Control-plane tables include:
- users, sessions, authentication factors;
- organizations and organization hierarchy closure/path data;
- organization memberships and delegated administrator grants;
- Projects and owner principal;
- Project grants, roles, and access epochs;
- licenses, entitlements, quotas, and policy versions;
- settings whose scope is User or Organization;
- control-plane audit events.
Project execution tables include:
- resources and revisioned aggregates;
- ChangeSets, Activity, History, Project outbox/change cursor;
- user×Project Workspace;
- jobs and derived artifacts;
- Knowledge/text/structured/media lattices;
- Project-scoped settings.
No control-plane row grants access merely because a runtime cell exists. No Project capability mutates ownership, enterprise membership, or license state.
## User-level library access
Personality, Context, and Template canonical originals are User-owned in V1. Their library routes are accessible before Project selection through the User Cell, but:
- library authorization is user/grant scoped;
- bringing an asset into a Project requires Project admission;
- the Project receives an independent copy/materialization with provenance;
- Organization grants may permit use or editing without changing canonical ownership;
- no Project Subcell is needed to browse a User's personal library.
## Revocation and consistency
- Every new operation uses current admission.
- Access epoch increments invalidate stale cached admission.
- Lists/search/history/errors are caller-aware and fail closed.
- A request already inside a capability may finish computation, but publication rechecks when policy requires.
- Durable jobs always reauthorize before publication.
- Live subscriptions stop or redact when access changes.
- Runtime caches include access epoch and cannot outlive revocation rules.
## Scaling
Control-plane services may remain modules in the Omega binary initially. They can later be isolated behind stable ports because Project capabilities depend only on bounded admission, not on enterprise storage internals.
User affinity may be added at the edge to reuse warm User Cells. It is not part of admission and is not persisted as Project authority. If a future deployment needs User placement metadata, it belongs to a replaceable runtime directory keyed by `UserID`, not to Project ownership/grant tables.
## Acceptance
1. Alice and Bob may both be admitted to one Project and still acquire distinct Project Subcells.
2. Revoking Bob blocks his next operation without stopping Alice's subcell.
3. Organization ownership grants no implicit shared login and no implicit administrator content access.
4. A user-library asset can be browsed without a Project and copied into an admitted Project with provenance.
5. No capability imports enterprise membership/license repositories directly.
6. No admission response or database schema requires Project placement.


---
title: "Work Packet — Ω-040 — Establish identity, Organization, Project ownership, and grants"
notion_page_id: "3acb6410e50281cab417e06f369b242a"
notion_url: "https://app.notion.com/3acb6410e50281cab417e06f369b242a"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:49:09Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-040 — Establish identity, Organization, Project ownership, and grants

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🛡️" color="blue_bg">
	**Queued — Wave 5.** Establish the minimum production identity, Organization, Project ownership, grant, and per-operation admission model. Organizations are principals; Users authenticate; admitted work executes through `UserCell → ProjectSubcell`.
</callout>
## Outcome
Omega has one fail-closed control-plane model for:
- authenticated Users and sessions;
- Organizations that may contain Organizations;
- Organization membership and delegated administration;
- User or Organization Project ownership;
- explicit Project grants and effective roles;
- current per-action Project admission and access epochs;
- Project discovery without content leakage;
- explicit System principals for background work.
This packet does not make enterprise internals part of Project capabilities.
## Dependencies
- Ω-001 baseline and route inventory.
- Ω-009/Ω-010 caller-aware reads and stable errors.
- Ω-011 explicit Project request scope.
- Ω-013 User Cell / Project Subcell runtime.
- Ω-038/Ω-039 user-library grant/lineage behavior.
## Non-goals
- No Organization shared login.
- No implicit administrator access to Project content.
- No Organization-owned user-library canonical master in V1.
- No cross-root Organization move or Project transfer without an explicit later design.
- No Project placement directory, Project activation lease, or shared Project Cell.
- No full SSO/SCIM/billing UI; Ω-041 owns the minimum settings/admin/license surface.
## Invariants
1. A User is the authenticating human.
2. An Organization is an ownership, grant, policy, and administration principal.
3. A Project has exactly one owner principal: User or Organization.
4. Administration and content access are distinct permissions.
5. Every Project request names `ProjectID` and `Action` and receives current admission.
6. Revocation increments access epoch and blocks new work.
7. Runtime cell acquisition follows admission and never grants authority.
8. Collaborators on one Project execute in distinct `(UserID, ProjectID)` subcells.
## Principal and ownership model
```go
type PrincipalRef struct {
    Kind PrincipalKind // user | organization | system
    ID   string
}

type Project struct {
    ID             ProjectID
    Owner          PrincipalRef
    AccessEpoch    int64
    PolicyVersion  int64
    CreatedAt      time.Time
}
```
Organizations are acyclic. Use closure/path materialization or another proven store representation with transactionally maintained ancestry and cycle prevention.
## Admission
```go
type ProjectAdmissionRequest struct {
    SubjectUserID UserID
    ProjectID     ProjectID
    Action        Action
    SessionID     SessionID
    RequestID     string
}

type ProjectAdmission struct {
    SubjectUserID UserID
    ProjectID     ProjectID
    EffectiveRole Role
    AccessPaths   []AccessPath
    AccessEpoch   int64
    PolicyVersion int64
    Entitlements  EntitlementSet
}
```
Admission evaluates ownership, direct grants, Organization-derived grants, membership, policy, license/entitlements, and action. It returns explainable paths but not sensitive hidden-principal details to unauthorized callers.
There is no placement field. After admission:
```plain text
Acquire UserCell(SubjectUserID)
  → Acquire ProjectSubcell(SubjectUserID, ProjectID)
      → Execute capability with bounded ProjectScope
```
## Persistence
Minimum tables:
- `users`, `sessions`, authentication factors;
- `organizations`, `organization_closure`;
- `organization_memberships`, delegated admin grants;
- `projects` with owner kind/id and access epoch;
- `project_grants` to User or Organization principals;
- role/action mappings and policy versions;
- license/entitlement assignments needed for admission;
- control-plane audit events.
All uniqueness, foreign-key, cycle, and ownership invariants are enforced in transactions. Index admission paths by subject, Organization ancestry, Project, grant principal, and access epoch.
## Request and job behavior
- Selected Project is navigation state only.
- Handler scope is explicit.
- Lists and search include only discoverable Projects.
- Resource errors do not confirm hidden IDs/names.
- Long jobs persist actor/action/access epoch and reauthorize before publication.
- System jobs use a bounded System principal.
- Live subscriptions reauthorize or close on access change.
## Ordered implementation
1. Inventory current users, sessions, Projects, grants, Organization work, and route guards.
2. Freeze principal, ownership, membership, role/action, and admission contracts.
3. Add migration-safe schemas, constraints, indexes, and audit events.
4. Implement Organization hierarchy/cycle proof.
5. Implement Project ownership and grants.
6. Implement fresh admission and access-epoch invalidation.
7. Replace direct enterprise reads in handlers/capabilities with ports.
8. Integrate User Cell/Project Subcell acquisition after admission.
9. Make discovery/list/search/error/history/job/live paths caller-aware.
10. Add negative-access, hierarchy, revocation, concurrency, and load tests.
## Required proof
- User-owned and Organization-owned Projects admit correctly.
- nested Organization membership derives only intended access.
- a hierarchy cycle is rejected atomically.
- Organization admin without a content grant cannot read Project content.
- revocation blocks the next command and job publication.
- Alice and Bob admitted to one Project receive distinct subcells.
- no Project placement record or shared Project runtime is required.
- Project discovery and error shapes do not leak inaccessible resources.
## Completion evidence
Record migrations, principal/action matrix, negative-access suite, hierarchy/cycle tests, revocation traces, admission latency/load measurements, cell-acquisition integration tests, commits, and residual risks.


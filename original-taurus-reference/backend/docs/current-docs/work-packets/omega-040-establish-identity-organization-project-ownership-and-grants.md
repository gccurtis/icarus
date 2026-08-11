---
title: "Execute Ω-040 — Establish identity, Organization, Project ownership, and grants"
packet_id: "Ω-040"
status: "ready-for-execution"
wave: "Wave 5"
depends_on: "Ω-001, Ω-009, Ω-010, Ω-011, Ω-013, Ω-038, Ω-039"
source_mirror: "docs/current-docs/notion/work-packets/omega-040-establish-identity-organization-project-ownership-and-grants.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-040 — Establish identity, Organization, Project ownership, and grants

## Mission

Omega has one fail-closed control-plane model for: - authenticated Users and sessions; - Organizations that may contain Organizations; - Organization membership and delegated administration; - User or Organization Project ownership; - explicit Project grants and effective roles; - current per-action Project admission and access epochs; - Project discovery without content leakage; - explicit System principals for background work. This packet does not make enterprise internals part of Project capabilities.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-001, Ω-009, Ω-010, Ω-011, Ω-013, Ω-038, Ω-039**.

Source dependency statement: - Ω-001 baseline and route inventory.
- Ω-009/Ω-010 caller-aware reads and stable errors.
- Ω-011 explicit Project request scope.
- Ω-013 User Cell / Project Subcell runtime.
- Ω-038/Ω-039 user-library grant/lineage behavior.

No later-packet integration gate was detected in the source dependency statement.

Start only after every hard predecessor is present on `main`. If a predecessor is intentionally being developed in parallel, do not guess across its contract: stop until it lands on `main` or request an agreed interface.

## Authority order

When sources disagree, use this order:

1. The latest explicit product decision from the user.
2. The current Primary documents under `docs/current-docs/notion/primary/`.
3. This execution directive and the packet-specific implementation specification below.
4. Current code, tests, migrations, and as-built architecture records on the actual starting `main`.
5. Supporting documents and frozen historical links.

`AGENTS.md` remains authoritative for repository workflow. The SHA in this file is the planning baseline, not an instruction to reset: always begin from the latest approved `main` that contains the required predecessors, and record the actual starting SHA.

## Required reading before editing

- `AGENTS.md` — repository rules; this is authoritative for workflow, validation, and documentation records.
- `docs/current-docs/README.md` — authority model and corpus layout.
- `docs/current-docs/notion/work-packets/omega-040-establish-identity-organization-project-ownership-and-grants.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.

Follow links inside the embedded specification when they resolve to additional local mirrors. Search the current repository for every type, route, table, tool, and invariant named below; do not rely on an old path or assume absence without checking.

## Preflight

Before changing code:

1. Record the starting `main` HEAD SHA, merged predecessor packets, and relevant existing records.
2. Reproduce or characterize the current gap with a focused test, probe, route inventory, or schema inspection.
3. Compare the packet against current code. Preserve correct partial implementations and delete or migrate only what the specification makes obsolete.
4. Identify the capability owner, its inbound ports, outbound ports, adapters, durable state, authorization point, transaction boundary, and observability boundary.
5. Confirm every proposed third-party dependency is free/open-source, pinned, and compatible with product distribution. Prefer the standard library or existing dependencies.
6. Write the smallest ordered implementation plan that can land without leaving accepted-but-unusable intermediate states.

If the gap is already fully closed, do not manufacture changes. Prove it with the required tests/evidence, reconcile stale documentation, and produce the normal change record and a verified commit on `main`.

## Execution contract

- Stay inside this packet's scope and explicit prerequisites. Do not opportunistically implement later packets.
- Preserve the modular-monolith, ports-and-adapters boundary. User Cells and per-user Project Subcells are logical runtime scopes; durable database state, revisions, CAS/idempotency, jobs, and outbox/change streams are correctness authorities.
- Enforce authorization at the owning application service/store boundary, not only in HTTP handlers. Reads, listings, search, events, history, jobs, and model/tool hydration must be caller-aware.
- Make durable mutations atomic at the stated aggregate boundary. Couple canonical state and required outbox/audit/idempotency writes in one transaction where the specification requires it.
- Keep retries, pagination, resource limits, concurrency, shutdown, and failure behavior explicit and bounded. No correctness may depend on sticky routing or one in-memory cell.
- Add or update typed errors and stable wire mappings without leaking hidden resource existence or secrets.
- Prefer focused tests first, then implementation, then broader integration, race, recovery, and load evidence required by the specification.
- Do not add placeholder handlers, no-op adapters, unbounded defaults, silent fallbacks, or TODO-only completion.
- Do not create companion `.go.md` files; that convention is retired. Add the numbered change record required by `AGENTS.md`.

## Decision authority

You may decide internal naming, package decomposition, private helper design, migration mechanics, indexes, test fixtures, and the exact FOSS library when the packet leaves those open. Choose the smallest production-grade option consistent with existing conventions. Record every material choice and rejected alternative in the change record.

Stop and ask for direction before proceeding if any choice would:

- contradict a settled Product/Primary architecture decision or another merged packet;
- weaken tenant, user, organization, project, or resource privacy boundaries;
- introduce destructive or irreversible migration without a tested rollback/restore path;
- add a non-FOSS, source-available-only, or materially costly external dependency/service;
- change a public contract outside this packet or make a later packet impossible;
- require guessing an unmerged predecessor's interface; or
- make an acceptance criterion impossible or only cosmetically satisfied.

## Validation and evidence

Run the narrowest relevant tests while iterating. Before commit, run the repository gates from `AGENTS.md`:

```bash
./scripts/check-format.sh
go build ./...
go test ./...
```

Also run every packet-specific test, race test, integration test, migration test, recovery test, load test, or live-provider certification required below. Live-provider tests may be skipped only when the required credential is unavailable; report the skip, fixture coverage, token/cost estimate where applicable, and the exact command for a credentialed rerun. Never claim a skipped gate passed.

Review the final diff for secret leakage, hidden-resource inference, unsafe logs, accidental broad scope, stale generated files, and unclassified dependencies.

## Required deliverables

1. Production implementation and migrations/adapters required by the specification.
2. Focused and broad automated tests proving the acceptance criteria.
3. API/schema/error/operations documentation actually changed by the implementation.
4. One new numbered `docs/records/NNNN-<slug>.md` record describing baseline, decisions, files, tests, operational effects, and remaining risks.
5. A commit scoped to this packet, pushed directly to `origin/main`.

The change record and completion handoff must state:

- actual baseline SHA and prerequisite packet status;
- outcome and user-visible/operational behavior;
- architecture and data-model decisions;
- migrations, compatibility, rollback, and rollout notes;
- security/privacy analysis;
- tests and exact commands/results, including skips;
- observability and operator impact;
- unresolved risks or follow-up packets; and
- a checklist mapping every acceptance criterion below to code/tests/evidence.

## Completion response

Return a concise handoff containing: commit SHA, changed areas, test results, migration/rollout notes, record path, and any explicit residual risk. Do not report this packet complete while an acceptance criterion is unproven or a required gate is failing.

---

## Embedded implementation specification

Source mirror: `docs/current-docs/notion/work-packets/omega-040-establish-identity-organization-project-ownership-and-grants.md`

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


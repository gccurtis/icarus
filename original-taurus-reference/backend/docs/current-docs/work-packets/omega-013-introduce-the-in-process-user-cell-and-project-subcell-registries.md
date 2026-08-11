---
title: "Execute Ω-013 — Introduce the in-process User Cell and Project Subcell registries"
packet_id: "Ω-013"
status: "ready-for-execution"
wave: "Wave 1"
depends_on: "Ω-001, Ω-009, Ω-010, Ω-011, Ω-012"
source_mirror: "docs/current-docs/notion/work-packets/omega-013-introduce-the-in-process-user-cell-and-project-subcell-registries.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-013 — Introduce the in-process User Cell and Project Subcell registries

## Mission

Omega has an explicit, testable runtime façade for: - one logical User Cell per authenticated User; - one logical Project Subcell per Project within that User Cell; - same-User multi-device reuse; - different-User separation on a shared Project; - bounded activation, reference leasing, idle eviction, drain, and rehydration; - explicit capability dispatch with fixed User and Project scope. This packet supplies execution organization only. Ω-014 supplies durable Project change delivery, jobs, presence, and collaboration behavior.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-001, Ω-009, Ω-010, Ω-011, Ω-012**.

Source dependency statement: - Ω-001 executable baseline.
- Ω-009/Ω-010 caller-aware read and wire contracts.
- Ω-011 explicit Project scope and fresh admission.
- Ω-012 typed User × Project Workspace.

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
- `docs/current-docs/notion/work-packets/omega-013-introduce-the-in-process-user-cell-and-project-subcell-registries.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/handlers/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/runtimecell/*_test.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/runtimecell/lifecycle.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/runtimecell/limits.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/runtimecell/project_subcell.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/runtimecell/registry.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/runtimecell/user_cell.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/transport/` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/wiring/runtime_cells.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/wiring/wiring.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `docs/architecture/runtime-model.md` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `docs/backend-guide.md` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-013-introduce-the-in-process-user-cell-and-project-subcell-registries.md`

<callout icon="⬡" color="purple_bg">
	**Frozen-baseline architecture decision.** A User Cell and its `ProjectSubcell(UserID, ProjectID)` children are lightweight logical façades inside a modular Omega replica. They hold scoped adapters, subscriptions, cursors, caches, and lifecycle state only. They do **not** create per-cell stores, migrations, database pools, worker pools, model/provider clients, or deployable applications. Duplicate physical incarnations after failover are harmless because durable CAS/idempotency/outbox state is authoritative.
</callout>
<callout icon="🧬" color="blue_bg">
	**Queued — Wave 1.** Introduce the bounded in-process `UserCell(UserID) → ProjectSubcell(UserID, ProjectID)` execution hierarchy. Do not create a process-wide shared Project Cell. Canonical state remains in revisioned stores.
</callout>
## Outcome
Omega has an explicit, testable runtime façade for:
- one logical User Cell per authenticated User;
- one logical Project Subcell per Project within that User Cell;
- same-User multi-device reuse;
- different-User separation on a shared Project;
- bounded activation, reference leasing, idle eviction, drain, and rehydration;
- explicit capability dispatch with fixed User and Project scope.
This packet supplies execution organization only. Ω-014 supplies durable Project change delivery, jobs, presence, and collaboration behavior.
## Dependencies
- Ω-001 executable baseline.
- Ω-009/Ω-010 caller-aware read and wire contracts.
- Ω-011 explicit Project scope and fresh admission.
- Ω-012 typed User × Project Workspace.
## Baseline
Omega composes mostly stateless capability services over Project-scoped stores. Workspace is user×Project. The database revision/CAS model is already the true concurrency authority, but the composition root has no named User runtime root, no per-User Project-subcell registry, and no bounded lifecycle.
## Scope
- `UserCellRegistry` keyed by `UserID`.
- `UserCell` containing a `ProjectSubcellRegistry` keyed by `ProjectID`.
- `ProjectSubcell` binding `(SubjectUserID, ProjectID)`.
- single-flight construction inside one process.
- request and subscription leases/reference counts.
- hard limits, idle TTL, graceful drain, and metrics.
- Workspace and user-level library/Agent facades attached at the correct level.
- handler/tool/job integration through stable interfaces.
- race, lifecycle, isolation, and load tests.
## Non-goals
- No shared Project Cell keyed only by Project ID.
- No Project placement directory, activation lease, generation, fencing, or mobility.
- No canonical state in cell memory.
- No authorization by cell existence or acquisition.
- No multi-node routing requirement; Ω-043 packages P1 and documents P2 evolution.
- No job/live-delivery behavior; Ω-014 owns it.
## Governing invariants
1. `UserCellKey = UserID`.
2. `ProjectSubcellKey = (UserID, ProjectID)`.
3. Alice and Bob on the same Project have separate Project Subcells.
4. Alice on two devices uses one logical Alice×Project subcell.
5. Every acquisition follows authentication and fresh Project admission.
6. Cell-local state is bounded, disposable, and tagged by revision/cursor.
7. Store CAS/idempotency, not process mutexes, protects accepted writes.
8. Restart or eviction rehydrates from canonical stores without losing accepted work.
## Runtime contracts
```go
package runtimecell

type UserCellRegistry interface {
    Acquire(ctx context.Context, userID identity.UserID) (*UserCell, Release, error)
    Drain(ctx context.Context) error
    Stats() RegistryStats
}

type UserCell struct {
    userID   identity.UserID
    projects ProjectSubcellRegistry
    libraries UserLibraryFacade
    agents    UserAgentFacade
}

type ProjectSubcellRegistry interface {
    Acquire(
        ctx context.Context,
        admission control.ProjectAdmission,
    ) (*ProjectSubcell, Release, error)
}

type ProjectSubcell struct {
    scope     capability.ProjectScope
    workspace workspace.Facade
    // bounded projections, connections, and adapters only
}

type Release func()
```
```go
type ProjectScope struct {
    SubjectUserID identity.UserID
    ProjectID     project.ID
    AccessEpoch   int64
    RequestID     string
}
```
`ProjectSubcell` must not expose a broad service locator. Give it explicit façades/ports so capability isolation remains enforceable.
## Registry algorithm
```go
func (r *Registry) Acquire(ctx context.Context, userID UserID) (*UserCell, Release, error) {
    // Lock only registry bookkeeping.
    // Reuse an existing entry or single-flight construction.
    // Increment refs before returning.
    // Never perform store I/O while holding the registry mutex.
}

func (u *UserCell) AcquireProject(
    ctx context.Context,
    admission ProjectAdmission,
) (*ProjectSubcell, Release, error) {
    if admission.SubjectUserID != u.userID {
        return nil, nil, ErrScopeMismatch
    }
    // Registry key is admission.ProjectID inside this User Cell.
}
```
Construction failures do not publish partial entries. Cancellation does not leak references. A released idle entry becomes eviction-eligible; active request/subscription references prevent eviction.
## Lifecycle
```plain text
absent → activating → warm → idle → evicted
                    ↘ draining → evicted
```
- Activation loads only bounded Workspace/projection/cursor state.
- Idle timers update after the last reference is released.
- Drain rejects new long-lived subscriptions, waits to a deadline, and releases memory.
- No “flush canonical state” step exists: accepted state was committed before being acknowledged.
## Limits and configuration
```go
type CellConfig struct {
    MaxUsersPerNode           int
    MaxProjectSubcellsPerUser int
    MaxProjectSubcellsPerNode int
    IdleTTL                   time.Duration
    DrainTimeout              time.Duration
    MaxConnectionsPerUser     int
    MaxConnectionsPerSubcell  int
    MaxCacheBytesPerSubcell   int64
}
```
Invalid or unbounded production values fail startup preflight. Capacity errors use stable codes and retry guidance.
## Likely paths
- `core/runtimecell/registry.go`
- `core/runtimecell/user_cell.go`
- `core/runtimecell/project_subcell.go`
- `core/runtimecell/lifecycle.go`
- `core/runtimecell/limits.go`
- `core/runtimecell/*_test.go`
- `core/wiring/runtime_cells.go`
- `core/wiring/wiring.go`
- `core/transport/`
- `core/handlers/`
- `docs/architecture/runtime-model.md`
- `docs/backend-guide.md`
Match the repository's final naming conventions; do not preserve the obsolete `projectcell` package name.
## Ordered implementation
1. Re-pin main and inventory composition/request paths.
2. Define cell keys, scope, stable errors, and lifecycle state.
3. Implement single-flight User Cell registry with limits and reference leases.
4. Implement per-User Project Subcell registry.
5. Bind typed Workspace and explicit capability façades.
6. Route admitted handlers and Agent tool calls through acquisition.
7. Add idle eviction, drain, observability, and configuration validation.
8. Add unit, race, lifecycle, scope-isolation, and load tests.
9. Update runtime model, wiring documentation, and migration notes.
## Required proof
- 100 concurrent acquisitions for one User construct one logical in-process cell.
- one User opening the same Project from two connections reuses one logical subcell.
- two Users opening the same Project receive different subcells.
- no subcell can be acquired with mismatched admission/user identity.
- active leases prevent eviction; idle entries evict; reacquisition restores Workspace.
- process-local construction races pass `go test -race`.
- registry saturation rejects predictably and recovers after eviction.
- accepted resource state survives cell drain/restart because it is store-backed.
- repository docs contain no assertion that authorized collaborators share one Project Cell.
## Completion evidence
Record:
- baseline and completion commits;
- exact interfaces and paths;
- test and race commands;
- lifecycle/load measurements and configured limits;
- examples proving same-User reuse and different-User separation;
- updated architecture and rollback notes;
- known limitations and residual risks.


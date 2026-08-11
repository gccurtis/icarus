---
title: "Work Packet — Ω-013 — Introduce the in-process User Cell and Project Subcell registries"
notion_page_id: "3acb6410e5028126b080c561a30f01f4"
notion_url: "https://app.notion.com/3acb6410e5028126b080c561a30f01f4"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:57:56Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-013 — Introduce the in-process User Cell and Project Subcell registries

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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


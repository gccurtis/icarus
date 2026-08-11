---
title: "Implementation — Control Plane, User Cell & Project Subcell Integration"
notion_page_id: "3acb6410e50281b2999bce58d559d902"
notion_url: "https://app.notion.com/3acb6410e50281b2999bce58d559d902"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 22:22:55Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Implementation — Control Plane, User Cell & Project Subcell Integration

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🧩" color="blue_bg">
	**Frozen-baseline implementation correction.** Add explicit Project route admission first, then lightweight cell/subcell registries over shared application ports. Do not reconstruct capability graphs per cell. Factories receive complete scoped port bundles and readiness fails on missing/duplicate registrations. Jobs retain initiating User/Project authority; live connections carry separate Connection IDs; any node rehydrates from durable Workspace/change cursors. Ω-004 supplies import/adapter enforcement and Ω-002/Ω-015 remove canonical exact reads from Knowledge.
</callout>
<callout icon="🧭" color="blue_bg">
	**Migration target:** preserve the current `(user, project)` execution invariant, make it explicit as `UserCell → ProjectSubcell`, and add durable live convergence. Do not introduce a shared Project Cell or a distributed Project placement system.
</callout>
## Starting point
Current Omega already has the most important foundations:
- capability calls and stored records are predominantly Project-scoped;
- Workspace is scoped by User and Project;
- document/resource revisions and store CAS are the real write authority;
- session activity records User and Project;
- capability services are mostly stateless over stores;
- the composition root is still process-global and request Project identity is partly session-selected;
- live delivery and Project-wide durable change catch-up are not yet a complete common contract.
The migration makes the user-first execution hierarchy explicit without moving canonical state into memory.
## Target packages
```plain text
core/runtimecell/
  registry.go          # UserCellRegistry
  user_cell.go         # one logical cell per User
  project_subcell.go   # one logical subcell per User×Project
  lifecycle.go
  limits.go
  metrics.go

core/capability/changefeed/
  model.go
  store.go
  publisher.go
  cursor.go

core/platform/live/
  inprocess.go
  postgres_notify.go   # optional P2 wake-up adapter

core/control/
  admission.go
  identity.go
  grants.go
  entitlements.go
```
Use current repository naming when implementation begins; the contracts and boundaries are normative, not these exact paths.
## M0 — Re-pin and inventory
- re-pin the current Omega commit;
- inventory request scope, store keys, revisions, jobs, subscriptions, Workspace, and session activity;
- identify any capability read/write that lacks explicit `UserID` or `ProjectID`;
- record the current SQLite/PostgreSQL migration state and in-flight Workspace work.
Exit: the executable contract and changed-path map are current.
## M1 — Explicit request scope
- Project routes name `ProjectID`;
- handlers declare an `Action`;
- authentication yields `SubjectUserID`;
- fresh admission produces a bounded `ProjectAdmission`;
- remove selected-Project navigation state as authorization;
- keep capability APIs explicit and caller-aware.
```go
type ProjectScope struct {
    SubjectUserID UserID
    ProjectID     ProjectID
    AccessEpoch   int64
    RequestID     string
}
```
Exit: two simultaneous Projects in one session cannot cross-scope; negative-access tests cover lists, search, history, errors, evidence, and jobs.
## M2 — Typed Workspace
- create `workspace_aggregates`, leaving the legacy `workspaces` table parked;
- use User × Project × Workspace identity;
- migrate on first read with clean-default fallback;
- implement revision CAS, immutable ChangeSets, global user-action sequence, and visible-only undo;
- ensure undo reopens/reveals a closed resource before the content operation commits.
Exit: Workspace restores across restart and never performs invisible content undo.
## M3 — User Cell registry
Introduce the bounded in-process registry keyed by `UserID`:
```go
type UserCellRegistry interface {
    Acquire(context.Context, UserID) (*UserCell, Release, error)
}
```
- single-flight construction inside one process;
- reference-counted request/subscription leases;
- idle TTL, hard limits, graceful drain, and metrics;
- user-level library and Agent activity facades;
- no cached authorization beyond bounded admission metadata.
Exit: multiple devices for one User reuse one logical User Cell; eviction is safe.
## M4 — Project Subcell registry
Inside each User Cell, add one subcell per Project:
```go
type ProjectSubcellKey struct {
    UserID    UserID
    ProjectID ProjectID
}
```
- acquisition requires `ProjectAdmission`;
- bind fixed User and Project scope;
- attach Workspace, connections, presence, resource subscriptions, and revision-tagged caches;
- keep capability/store services external and explicit;
- do not create a process-wide Project registry.
Exit: Alice and Bob sharing one Project receive distinct subcells; Alice's devices reuse Alice's one logical subcell.
## M5 — Durable Project change stream
Add a transactionally written outbox/change table:
```go
type ProjectChange struct {
    Cursor        int64
    ProjectID     ProjectID
    AggregateType string
    AggregateID   string
    Revision      int64
    ChangeSetID   string
    ActorUserID   *UserID
    CommittedAt   time.Time
}
```
- commit aggregate state, ChangeSet, Activity, idempotency receipt, and outbox atomically;
- signal only after commit;
- provide `ListAfter(ProjectID, Cursor)` and bounded retention/snapshot fallback;
- make duplicate application idempotent;
- expose durable cursors to Workspace/connections.
Exit: a deliberately dropped live signal cannot cause permanent divergence.
## M6 — Jobs, presence, and live delivery
- durable job envelopes carry Project, actor/service principal, Action, access epoch, and idempotency;
- workers run without requiring a resident User Cell;
- user jobs reauthorize before publication;
- job lease prevents concurrent attempt ownership; revision/idempotency prevents duplicate state;
- presence is TTL state keyed by Project, User, and Connection;
- in-process hub wakes local subcells;
- P2 adapter may use PostgreSQL `LISTEN/NOTIFY` or another FOSS pub/sub implementation only as a wake-up path.
Exit: jobs and live collaboration remain correct through cell eviction, worker death, duplicate delivery, and reconnect.
## M7 — User libraries and control-plane minimum
- keep Personality, Context, and Template originals User-owned;
- allow user-level browsing before Project selection;
- implement grants, lineage, independent Project copies/materialization, and provenance;
- complete identity, Organizations-as-principals, ownership, settings, licenses/entitlements, administration, and audit;
- keep Project capabilities dependent only on bounded ports.
Exit: enterprise changes do not require capability rewrites.
## M8 — Production stores and P1 packaging
- PostgreSQL adapter for all canonical tables;
- object-store adapter and integrity/reaper paths;
- migrations, backup, restore, corruption checks, and capacity tests;
- bounded registries, queues, pools, and worker subprocesses;
- TLS, secrets, configuration, health/readiness, graceful drain, telemetry, runbooks;
- single-node full-system certification.
Exit: Product Backend Complete gate passes on P1.
## M9 — P2 only after measurement
- add multiple Omega nodes;
- use best-effort UserID affinity;
- add cross-node wake-up adapter while keeping durable cursor/outbox canonical;
- prove failover to another node;
- partition or shard Project data behind store ports only when measured.
There is no distributed Project placement milestone. If exclusive ephemeral User ownership later becomes useful, it is a replaceable optimization keyed by User—not a correctness boundary.
## Required tests
- `UserCell` single-flight acquisition, reuse, limits, idle eviction, and drain;
- per-User Project Subcell cardinality;
- separate Alice/Bob subcells for one shared Project;
- same-User multi-device reuse;
- CAS race and explicit conflict/rebase;
- atomic state/ChangeSet/Activity/outbox commit;
- missed/duplicate/out-of-order wake-up with cursor catch-up;
- snapshot fallback after retention;
- cell eviction/restart/reacquisition;
- cross-node reacquisition without sticky-session correctness;
- revocation and long-job reauthorization;
- job lease loss, retry, and stale-result rejection;
- caller-aware negative access across every read surface;
- race detector and load/capacity proof.
## Rollback
- registry layers are façades; handlers can temporarily fall back to explicit scoped capability calls;
- live wake-up adapters can be disabled while durable cursor polling remains;
- old Workspace storage stays parked until typed read/write and recovery proof passes;
- database migrations are forward-only and preserve canonical data;
- no rollback may restore session-selected Project authorization or one shared Project runtime.
## Work-packet mapping
- Ω-011: explicit Project scope and admission;
- Ω-012: typed User × Project Workspace;
- Ω-013: User Cell and Project Subcell registries;
- Ω-014: jobs, presence, durable outbox/cursors, and live delivery;
- Ω-015–Ω-037: Project capabilities execute through explicit subcell scope;
- Ω-038–Ω-041: user libraries and control plane;
- Ω-042: PostgreSQL/object data and recovery;
- Ω-043: bounded P1 deployment;
- Ω-044: full proof, including distinct collaborator subcells and catch-up.
The program remains 44 packets. This correction changes packet contracts; it does not add a new feature packet.


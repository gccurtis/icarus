---
title: "Execute Ω-043 — Package and operate the production single-node deployment"
packet_id: "Ω-043"
status: "ready-for-execution"
wave: "Wave 6"
depends_on: "Ω-001, Ω-002, Ω-003, Ω-004, Ω-005, Ω-006, Ω-007, Ω-008, Ω-009, Ω-010, Ω-011, Ω-012, Ω-013, Ω-014, Ω-015, Ω-016, Ω-017, Ω-018, Ω-019, Ω-020, Ω-021, Ω-022, Ω-023, Ω-024, Ω-025, Ω-026, Ω-027, Ω-028, Ω-029, Ω-030, Ω-031, Ω-032, Ω-033, Ω-034, Ω-035, Ω-036, Ω-037, Ω-038, Ω-039, Ω-040, Ω-041, Ω-042"
source_mirror: "docs/current-docs/notion/work-packets/omega-043-package-and-operate-the-production-single-node-deployment.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-043 — Package and operate the production single-node deployment

## Mission

One reproducible production deployment can run the complete Taurus backend safely: ```plain text TLS edge ├─ Alpha static application └─ Omega HTTP + WebSocket ├─ control plane and explicit Project admission ├─ bounded User Cell registry │ └─ per-User bounded Project Subcell registries ├─ capability services ├─ in-process live wake-up hub + durable Project outbox ├─ durable job workers ├─ sandboxed conversion/ingestion workers ├─ PostgreSQL ├─ object storage └─ backup/restore target ``` The system starts, migrates, serves, drains, upgrades, rolls back application code, backs up/restores data, and exposes enough telemetry to operate.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-001, Ω-002, Ω-003, Ω-004, Ω-005, Ω-006, Ω-007, Ω-008, Ω-009, Ω-010, Ω-011, Ω-012, Ω-013, Ω-014, Ω-015, Ω-016, Ω-017, Ω-018, Ω-019, Ω-020, Ω-021, Ω-022, Ω-023, Ω-024, Ω-025, Ω-026, Ω-027, Ω-028, Ω-029, Ω-030, Ω-031, Ω-032, Ω-033, Ω-034, Ω-035, Ω-036, Ω-037, Ω-038, Ω-039, Ω-040, Ω-041, Ω-042**.

Source dependency statement: - Ω-001 through Ω-041 complete.
- Ω-042 production stores, objects, migrations, backup, and restore.

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
- `docs/current-docs/notion/work-packets/omega-043-package-and-operate-the-production-single-node-deployment.md` — exact Notion source mirror for this packet.
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

Source mirror: `docs/current-docs/notion/work-packets/omega-043-package-and-operate-the-production-single-node-deployment.md`

<callout icon="🚀" color="purple_bg">
	**Frozen-baseline deployment decision.** Package one modular Omega application hosting many logical User Cells and Project Subcells, plus isolated conversion workers and shared durable job workers where security/load warrants. Start single-node; scale to identical replicas. User affinity and cross-node wake-ups are optional latency optimizations. No correctness may depend on sticky routing, one physical cell, or a shared Project runtime.
</callout>
<callout icon="🚀" color="blue_bg">
	**Queued — Wave 6.** Package and operate the managed P1 modular-monolith deployment with bounded User Cells and Project Subcells, durable stores/jobs/outbox, isolated workers, and complete runbooks. Project placement is not part of this packet.
</callout>
## Outcome
One reproducible production deployment can run the complete Taurus backend safely:
```plain text
TLS edge
  ├─ Alpha static application
  └─ Omega HTTP + WebSocket
       ├─ control plane and explicit Project admission
       ├─ bounded User Cell registry
       │    └─ per-User bounded Project Subcell registries
       ├─ capability services
       ├─ in-process live wake-up hub + durable Project outbox
       ├─ durable job workers
       ├─ sandboxed conversion/ingestion workers
       ├─ PostgreSQL
       ├─ object storage
       └─ backup/restore target
```
The system starts, migrates, serves, drains, upgrades, rolls back application code, backs up/restores data, and exposes enough telemetry to operate.
## Dependencies
- Ω-001 through Ω-041 complete.
- Ω-042 production stores, objects, migrations, backup, and restore.
## Scope
- container/package manifests for managed P1 and a documented sealed on-prem profile;
- TLS/reverse-proxy integration and Alpha/Omega routing;
- typed configuration and startup validation;
- secret injection/rotation boundaries;
- migration job and compatibility checks;
- health, readiness, graceful drain, and termination behavior;
- bounded User Cells, Project Subcells, connections, caches, queues, workers, and provider calls;
- in-process live fanout backed by durable Project change/outbox cursors;
- job and worker supervision;
- logs, metrics, traces, alerts, dashboards, and SLO/runbook linkage;
- install, upgrade, rollback, backup, restore, incident, and diagnostic procedures;
- capacity, soak, overload, restart, and recovery testing.
## Non-goals
- No distributed Project placement, Project activation leases, generations, fencing, or mobility.
- No one shared Project runtime.
- No multi-node P2 requirement to close Product Backend Complete.
- No proprietary runtime, database extension, queue, backup agent, or conversion service.
- No correctness dependency on sticky sessions or one physical User Cell.
## Configuration
```go
type RuntimeConfig struct {
    HTTP         HTTPConfig
    Database     DatabaseConfig
    Objects      ObjectConfig
    Backup       BackupConfig
    Sessions     SessionConfig
    UserCells       UserCellConfig
    ProjectSubcells ProjectSubcellConfig
    Live         LiveConfig
    Jobs         JobConfig
    Workers      WorkerConfig
    Providers    ProviderConfig
    Connectors   ConnectorConfig
    Telemetry    TelemetryConfig
}
```
Production startup rejects zero/unbounded unsafe limits, missing secrets, incompatible schema, unwritable object targets, or failed dependency preflight.
## Cell operation
- registry key is User ID;
- per-User subcell key is Project ID, yielding global identity `(UserID, ProjectID)`;
- activation is lazy and rehydrates from canonical state;
- request/subscription references prevent eviction;
- idle TTL and hard limits bound memory;
- drain rejects new long-lived work and releases memory after a deadline;
- accepted data never waits in cell memory for shutdown flush;
- restart and route changes recover via snapshot/revision/durable cursor.
## Live delivery and P2 readiness
P1 uses in-process wake-ups after atomic outbox commit. The transport also supports durable `changes?after=`/resume cursors.
The deployment contract leaves a port for a P2 remote wake-up adapter. If multiple application nodes are later justified:
- prefer UserID affinity for efficiency;
- allow failover to another node;
- use PostgreSQL `LISTEN/NOTIFY` or another FOSS pub/sub adapter as a hint;
- query the durable outbox after cursor;
- do not introduce Project placement.
## Health and drain
Liveness checks only process health. Readiness checks required dependencies, schema compatibility, object-store access, queue capacity, and drain state without performing destructive mutations.
Graceful drain:
1. mark unready;
2. reject new long-lived subscriptions and job claims;
3. allow bounded in-flight requests/publications;
4. record resumable cursors and close connections with retry metadata;
5. release cell memory;
6. stop workers and database pools by deadline.
## Observability
Dashboards/alerts cover:
- request rate, latency, error codes, authorization denials;
- active/idle User Cells and Project Subcells, activation/eviction, cache bytes;
- connections, slow consumers, wake-up failures, outbox lag, cursor gaps, snapshot fallbacks;
- database pool saturation, transaction latency, CAS conflicts, deadlocks/retries;
- object integrity, staging/reaper backlog;
- job depth, age, leases, retries, reauthorization/stale-result rejection;
- worker resource limits and sandbox failures;
- connector/provider quotas and rate limits;
- backup age, restore rehearsal, migration status, disk/capacity thresholds.
## Required proof
- clean install and startup from typed configuration;
- restart with active Users/Projects loses no accepted data;
- Alice/Bob distinct Project Subcells converge after reconnect;
- User Cell/subcell idle eviction and rehydration;
- dropped wake-up recovers from durable cursor;
- overload rejects/backpressures within configured memory/connection/queue bounds;
- graceful drain leaves no orphaned accepted mutation or double-published job;
- migration failure leaves the old version operable where schema compatibility permits;
- backup and restore produce verified resource/object/job/change integrity;
- sealed on-prem runbook can be followed without Taurus SaaS control dependencies;
- no proof depends on Project placement or a shared Project process.
## Ordered implementation
1. Freeze environment and topology contract.
2. Package Omega, workers, PostgreSQL, object storage, and edge.
3. Implement validation, migration preflight, health/readiness, and drain.
4. Wire cell, queue, connection, worker, and provider bounds.
5. Add telemetry, dashboards, alerts, and correlation IDs.
6. Write install/upgrade/rollback/backup/restore/incident/diagnostic runbooks.
7. Run restart, failure-injection, capacity, overload, soak, and recovery suites.
8. Record supported P1/on-prem profiles and P2 evolution contract.
## Completion evidence
Record immutable image/package identifiers, configuration schema, manifests, licenses/SBOM, test commands, capacity and soak measurements, failure/recovery traces, dashboard/runbook links, backup/restore checksums, commits, limitations, and residual risks.


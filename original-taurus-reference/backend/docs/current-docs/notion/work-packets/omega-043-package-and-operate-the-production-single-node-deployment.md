---
title: "Work Packet — Ω-043 — Package and operate the production single-node deployment"
notion_page_id: "3acb6410e50281b39bedccc751b658e8"
notion_url: "https://app.notion.com/3acb6410e50281b39bedccc751b658e8"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:58:23Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-043 — Package and operate the production single-node deployment

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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


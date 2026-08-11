---
title: "Deployment — Taurus Topology & Scaling Model"
notion_page_id: "3acb6410e502816585d9e96ff02921d8"
notion_url: "https://app.notion.com/3acb6410e502816585d9e96ff02921d8"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 22:22:55Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Deployment — Taurus Topology & Scaling Model

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

<callout icon="🚀" color="purple_bg">
	**Frozen-baseline deployment decision.** Deploy one modular Omega product initially, with shared durable job workers and isolated conversion workers where warranted. Scale to identical replicas behind a load balancer; each replica may host many logical User Cells/Subcells. User affinity and cross-node wake-ups optimize latency only. Never use per-user/per-project applications, databases, pools, migrations, or worker fleets, and never make sticky routing or one physical cell a correctness condition.
</callout>
<callout icon="🚀" color="blue_bg">
	**Deployment rule:** scale stateless Omega nodes around durable stores. Route by User for warm-state efficiency, create one logical Project Subcell per `(UserID, ProjectID)`, and never require distributed Project placement for correctness.
</callout>
## Deployment objectives
The topology must:
- preserve User/Project isolation and fresh admission;
- keep accepted state durable across process loss;
- allow Alpha clients to reconnect and resume;
- scale application, job, storage, and live-delivery pressure independently when measured;
- support managed cloud first without blocking a sealed on-premises profile;
- rely only on free/open-source runtime dependencies.
## Logical topology
```plain text
User → User Cell(UserID)
          ├─ Project Subcell(UserID, Project A)
          ├─ Project Subcell(UserID, Project B)
          └─ user libraries / user Agent activity
```
The cell hierarchy is logical. It may run inside one process initially and on any healthy application node later. Canonical state remains in PostgreSQL and object storage.
## P1 — Managed modular monolith
```plain text
Internet
  → TLS edge / load balancer
      ├─ Alpha static application
      └─ Omega HTTP + WebSocket
           ├─ control plane
           ├─ User Cell registry
           │    └─ bounded Project Subcell registries
           ├─ capability services
           ├─ in-process live wake-up hub
           ├─ durable job workers
           ├─ sandboxed conversion/ingestion workers
           ├─ PostgreSQL
           ├─ object storage
           └─ backup/restore target
```
P1 may be one Omega application process plus isolated worker subprocesses. The process hosts many logical User Cells. Idle cells/subcells are evicted and rehydrated.
Required:
- PostgreSQL connection pooling, migrations, point-in-time/periodic backup, and restore proof;
- object-store adapter with integrity metadata and lifecycle/reaper behavior;
- durable jobs, leases, retry budgets, idempotency, and reauthorization;
- typed configuration, secret injection/rotation, health/readiness, graceful drain;
- bounded cells, caches, queues, connections, worker pools, and provider requests;
- durable Project outbox/change cursor with in-process post-commit wake-ups;
- telemetry for access, revisions, cells, jobs, outbox lag, object integrity, and recovery.
## P2 — Horizontally replicated Omega
```plain text
Clients
  → edge/load balancer
      → Omega node 1 ─┐
      → Omega node 2 ─┼→ PostgreSQL + object storage + durable jobs/outbox
      → Omega node N ─┘             │
                         ephemeral cross-node wake-up
```
Routing:
- hash or affinitize by authenticated `UserID` where practical;
- affinity improves cache reuse and keeps one warm User Cell in the common case;
- retries and reconnects may land on another node;
- the receiving node reconstructs state from canonical stores and resumes from a durable cursor.
No Project placement directory is required. A shared Project can be used from many User Cells on many nodes. Database revision/CAS coordinates accepted writes.
Live delivery:
- the transaction commits a durable outbox row;
- an in-process hub wakes local subcells;
- PostgreSQL `NOTIFY` or an open-source pub/sub adapter wakes remote nodes;
- consumers query rows after their cursor;
- a dropped or duplicate signal cannot lose or double-apply accepted state.
PostgreSQL documents `NOTIFY` as a simple interprocess signal and recommends putting structured data in tables; delivery occurs after commit and payloads are bounded. Taurus therefore sends only a cursor/key as the hint. `LISTEN` startup must establish the listener and then inspect durable state to close the initial race.
## P3 — Measured specialization
Only split a component after metrics identify its bottleneck:
- independent job-worker pools by job class;
- independent sandboxed conversion or ingestion worker fleets;
- dedicated live-delivery gateway/backplane;
- read replicas for safe projections;
- declarative partitioning of large Project-owned tables;
- Project-based data sharding behind store adapters;
- region placement for Users, data residency, or latency.
P3 still preserves `UserCell(UserID) → ProjectSubcell(UserID, ProjectID)`. Data partitioning by Project ID is a persistence concern; it does not create one shared Project runtime.
## Canonical persistence and partition keys
Project-owned tables must contain and index `project_id`. User-owned tables must contain and index `owner_user_id`. User-in-Project tables such as Workspace must carry both.
```sql
CREATE TABLE workspace_aggregates (
    user_id       UUID NOT NULL,
    project_id    UUID NOT NULL,
    workspace_id  UUID NOT NULL,
    revision      BIGINT NOT NULL,
    snapshot      JSONB NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (user_id, project_id, workspace_id)
);

CREATE INDEX project_changes_project_cursor
    ON project_change_outbox(project_id, cursor);
```
PostgreSQL declarative partitioning may later divide very large logical tables, including hash partitioning, while preserving the table contract. Adopt it from measurements rather than pre-partitioning small tables.
## Failure and recovery behavior
<table header-row="true">
<tr>
<td>Failure</td>
<td>Required behavior</td>
</tr>
<tr>
<td>Omega process exits</td>
<td>accepted data survives; clients reconnect, cells rehydrate, cursors catch up</td>
</tr>
<tr>
<td>User-affinity route changes</td>
<td>new node acquires the User Cell and resumes from stores</td>
</tr>
<tr>
<td>wake-up signal is dropped</td>
<td>consumer polls/queries durable outbox after cursor</td>
</tr>
<tr>
<td>wake-up is duplicated</td>
<td>cursor/change-set id makes application idempotent</td>
</tr>
<tr>
<td>two Users race on one aggregate</td>
<td>one CAS succeeds; one typed conflict/rebase path</td>
</tr>
<tr>
<td>worker dies</td>
<td>lease expires; retry is bounded; publication remains idempotent</td>
</tr>
<tr>
<td>access is revoked</td>
<td>new commands fail; long jobs reauthorize before publish</td>
</tr>
<tr>
<td>object upload and DB publication diverge</td>
<td>staged object is unreferenced/reaped or transaction remains unpublished</td>
</tr>
<tr>
<td>database restore occurs</td>
<td>object/change/job integrity checks and recovery runbook prove consistency</td>
</tr>
</table>
## Capacity model
Scale and load-test these independent dimensions:
- authenticated users and active User Cells;
- Project Subcells per User and per node;
- concurrent editors per Project aggregate;
- WebSocket/subscription connections and outbound event rate;
- outbox rows/second and maximum consumer lag;
- PostgreSQL transactions, connection pool saturation, index/partition growth;
- object bytes and request rate;
- job queue depth, lease churn, worker CPU/memory;
- connector/provider rate limits;
- conversion/ingestion sandbox concurrency.
Cells must have hard bounds. Eviction is expected, not exceptional.
## Security boundaries
- The edge authenticates transport; the control plane authorizes every action.
- Node affinity and cell acquisition never grant access.
- Organizations remain principals, not login identities.
- Capability/store reads and writes include explicit Project scope and caller visibility.
- Secrets are injected and rotated outside canonical content stores.
- Workers receive bounded references and narrowly scoped credentials.
- Presence, caches, wake-up signals, and routing metadata are noncanonical.
## On-premises profile
The same topology can be packaged as a sealed single-node deployment:
- Omega modular monolith;
- PostgreSQL;
- S3-compatible open-source object store or supported filesystem-backed adapter;
- isolated worker subprocesses/containers;
- documented TLS, secret, backup, restore, upgrade, rollback, and diagnostic procedures.
SQLite/WAL remains a development authority and may qualify only after explicit single-node locking, load, backup, and restore proof. It is not the managed production default.
## What is deliberately absent
- distributed Project placement, Project activation leases, Project generations, or Project mobility;
- one shared Project process for all collaborators;
- correctness that depends on sticky sessions or one physical User Cell;
- one microservice per capability;
- proprietary queue, database extension, conversion service, or backup agent as a requirement.
If a future optimization needs exclusive ephemeral User ownership, add a `UserPlacementPort` behind the registry after measurement. It must remain replaceable and cannot become the authority for data correctness.
## Deployment gates
### P1 gate
- one node survives restart/reconnect with no accepted-data loss;
- Alice/Bob distinct subcells converge through the durable stream;
- cell eviction and Workspace restoration are proven;
- backup/restore, object integrity, jobs, conversions, connectors, and security suites pass;
- overload produces bounded rejection/backpressure rather than unbounded memory.
### P2 gate
- routing a User to another node rehydrates safely;
- remote wake-ups plus cursor catch-up work with dropped and duplicate signals;
- no global User singleton is required for correctness;
- measured capacity justifies multiple nodes.
### P3 gate
- specialization follows a measured bottleneck;
- store and event contracts remain stable;
- Project data partition/shard movement does not change cell identity;
- failure and recovery proof is repeated at the new topology.
## References
- [PostgreSQL: NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- [PostgreSQL: LISTEN](https://www.postgresql.org/docs/current/sql-listen.html)
- [PostgreSQL: Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [PostgreSQL: Concurrency Control](https://www.postgresql.org/docs/current/mvcc.html)
- [PostgreSQL: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)


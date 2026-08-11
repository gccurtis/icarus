---
title: "Execute Ω-042 — Add production storage, object data, migrations, backup, and restore"
packet_id: "Ω-042"
status: "ready-for-execution"
wave: "Wave 6 — Production and certification"
depends_on: "Ω-001, Ω-002, Ω-003, Ω-004, Ω-005, Ω-006, Ω-007, Ω-008, Ω-009, Ω-010, Ω-011, Ω-012, Ω-013, Ω-014, Ω-015, Ω-016, Ω-017, Ω-018, Ω-019, Ω-020, Ω-021, Ω-022, Ω-023, Ω-024, Ω-025, Ω-026, Ω-027, Ω-028, Ω-029, Ω-030, Ω-031, Ω-032, Ω-033, Ω-034, Ω-035, Ω-036, Ω-037, Ω-038, Ω-039, Ω-040, Ω-041"
source_mirror: "docs/current-docs/notion/work-packets/omega-042-add-production-storage-object-data-migrations-backup-and-restore.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-042 — Add production storage, object data, migrations, backup, and restore

## Mission

Omega runs its managed P1 production profile on PostgreSQL and a mandatory immutable object store behind Taurus-owned ports. Schema changes are explicit, checksummed, locked, observable release artifacts. Database and object backups are encrypted, catalogued, retained, and restored in recurring drills. A clean install, upgrade, rollback within the supported window, full restore, and Project-scoped recovery where feasible preserve stable IDs, revisions, lineage, receipts, and audit/outbox consistency. SQLite remains the D0 development/test adapter. It may be offered as a sealed single-node customer-managed profile only after it independently passes the same concurrency, WAL, backup, restore, locking, corruption, capacity, and operational gates. It is not the managed P1 baseline.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-001, Ω-002, Ω-003, Ω-004, Ω-005, Ω-006, Ω-007, Ω-008, Ω-009, Ω-010, Ω-011, Ω-012, Ω-013, Ω-014, Ω-015, Ω-016, Ω-017, Ω-018, Ω-019, Ω-020, Ω-021, Ω-022, Ω-023, Ω-024, Ω-025, Ω-026, Ω-027, Ω-028, Ω-029, Ω-030, Ω-031, Ω-032, Ω-033, Ω-034, Ω-035, Ω-036, Ω-037, Ω-038, Ω-039, Ω-040, Ω-041**.

Source dependency statement: all canonical schemas from Ω-001 through Ω-041.

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
- `docs/current-docs/notion/work-packets/omega-042-add-production-storage-object-data-migrations-backup-and-restore.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `docs/current-docs/notion/primary/architecture-enterprise-control-plane--3acb6410e502.md`
- `docs/current-docs/notion/primary/architecture-taurus-layered-application-model--3acb6410e502.md`
- `docs/current-docs/notion/primary/architecture-user-cell-and-project-subcell-runtime--3acb6410e502.md`
- `docs/current-docs/notion/primary/deployment-taurus-topology-and-scaling-model--3acb6410e502.md`
- `docs/current-docs/notion/primary/design-multi-lattice-ingestion-architecture--3acb6410e502.md`
- `docs/current-docs/notion/primary/implementation-control-plane-user-cell-and-project-subcell-integration--3acb6410e502.md`
- `docs/current-docs/notion/primary/model-media-capability-and-descriptor-lattice--3acb6410e502.md`
- `docs/current-docs/notion/primary/model-structured-data-capability-and-descriptor-lattice--3acb6410e502.md`
- `docs/current-docs/notion/primary/model-workspace-capability-and-runtime-contract--3acb6410e502.md`
- `docs/current-docs/notion/primary/workstreams-taurus-product-completion--3acb6410e502.md`

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

Source mirror: `docs/current-docs/notion/work-packets/omega-042-add-production-storage-object-data-migrations-backup-and-restore.md`

<callout icon="🗄️" color="purple_bg">
	**Frozen-baseline addendum.** PostgreSQL/object adapters implement capability-owned ports and preserve database CAS as authority. Add constraints/indexes for active lattice generation, exact artifact budgets/reservations, connector item/version uniqueness, source-generation cursors, job actor/Project scope, outbox ordering, and User/Project Workspace revision. Do not encode logical User Cells as schemas/databases or create per-cell connection pools.
</callout>
### Outcome
Omega runs its managed P1 production profile on PostgreSQL and a mandatory
immutable object store behind Taurus-owned ports. Schema changes are explicit,
checksummed, locked, observable release artifacts. Database and object backups
are encrypted, catalogued, retained, and restored in recurring drills. A clean
install, upgrade, rollback within the supported window, full restore, and
Project-scoped recovery where feasible preserve stable IDs, revisions,
lineage, receipts, and audit/outbox consistency.
SQLite remains the D0 development/test adapter. It may be offered as a sealed
single-node customer-managed profile only after it independently passes the
same concurrency, WAL, backup, restore, locking, corruption, capacity, and
operational gates. It is not the managed P1 baseline.
### Reviewed evidence and settled decision
- [Deployment — Taurus Topology & Scaling Model](https://app.notion.com/p/3acb6410e502816585d9e96ff02921d8)
- [Architecture — Taurus Layered Application Model](https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f)
- [Architecture — Enterprise Control Plane](https://app.notion.com/p/3acb6410e50281988386c4559a26cd22)
- [Architecture — User Cell & Project Subcell Runtime](https://app.notion.com/p/3acb6410e5028147909ef7214406baad)
- [Implementation — Control Plane, User Cell & Project Subcell Integration](https://app.notion.com/p/3acb6410e50281b2999bce58d559d902)
- [Workstreams - Taurus Product Completion](https://app.notion.com/p/3acb6410e50281bf8987c9a87e6687dd)
The older Workstreams reference to MySQL is stale. The completion authority is
PostgreSQL for managed P1. Store ports remain database-neutral enough to keep
SQLite D0 useful and to avoid leaking PostgreSQL details into capabilities.
Object storage is mandatory in P1 even when the application has local disk.
Distributed Project placement is not part of the Taurus runtime model. Multiple Omega nodes and a remote wake-up/queue adapter are separate, measurement-driven P2 concerns; canonical store contracts remain unchanged.
Use free/open-source clients and tooling only. A suitable Go PostgreSQL driver
is `pgx` (MIT); an S3-compatible adapter may use an Apache-2.0 Go SDK. Pin exact
versions during implementation. No proprietary database extension or
commercial backup agent may become required for ordinary operation.
### Scope
- PostgreSQL adapters for every canonical store and unit of work completed by
	Ω-001 through Ω-041.
- A connection/transaction abstraction that preserves Project scoping,
	revision CAS, idempotency, leases, outbox, and keyset pagination.
- Immutable streaming ObjectStore and File metadata; local filesystem adapter
	for D0 only.
- Explicit forward migrations, compatibility checks, preflight, checksums,
	lease/lock, progress, verification, and rollback plan.
- Database backup/PITR strategy, object inventory/retention, encryption and
	restore catalog.
- Full-system and, where practical, one-Project restore tooling.
- Orphan/staging reapers and consistency/integrity verification.
- Store parity, migration, backup, restore, corruption, and capacity tests.
### Non-goals
- Multiple Omega execution nodes, exclusive User-placement leases, or an
	external distributed queue.
- Capability SQL or object URLs/paths.
- Treating application-node disk, container layers, or process memory as
	canonical storage.
- Requiring one specific managed cloud vendor or a Taurus SaaS control call for
	on-prem operation.
- Zero-downtime migrations that materially increase complexity before there are
	multiple application nodes. Compatibility windows and bounded maintenance
	are sufficient for P1.
- Restoring ephemeral presence, leases, live connections, or cell memory as
	canonical content.
### Storage invariants
1. Capability and control-plane packages depend on stores/units of work, never
	PostgreSQL connection identity, SQL dialect, SQLite paths, or object keys.
2. Every canonical row contains explicit Project/control scope. Project store
	methods bind or require ProjectID and assert returned scope.
3. Aggregate writes use expected revision/version and transactionally append
	ChangeSet/Activity/audit/outbox/receipt records required by the command.
4. Durable jobs use leases, fencing/claim identity, retry time, idempotency, and
	actor/admission fields. Restart cannot lose accepted work or double-publish.
5. Object bytes are immutable and digest verified. Mutable metadata references
	a File/Object ID; it never embeds a server path or a public URL.
6. An object is staged and fully verified before a database transaction makes a
	File/reference visible. A rolled-back transaction leaves an unreferenced
	staged object for bounded reaping, not a partial canonical resource.
7. Object deletion is retention-aware and reference-count/inventory verified.
	Database deletion alone cannot immediately destroy recoverable bytes.
8. Backups are not complete until a restore verifies schema, canonical rows,
	objects/digests, references, IDs/revisions, audit/outbox, and application
	behavior.
9. Production migrations do not silently run on every application startup.
	A release preflight/migration step records explicit success before readiness.
10. A restored Project preserves stable IDs and revisions. Runtime placement,
	sessions as policy permits, ephemeral caches, and presence are rebuilt.
### Target packages and interfaces
```plain text
core/platform/storage/
  tx/                     transaction and retry policy
  postgres/               P1 stores and units of work
  sqlite/                 D0 stores and parity harness
  migrations/             manifest, runner, checksums, verification
core/platform/object/
  model.go                ObjectRef, metadata, digest, lifecycle
  store.go                streaming immutable port
  filesystem/             D0 adapter
  s3compatible/           P1 adapter
  inventory.go            reference/integrity/orphan checks
core/platform/backup/
  catalog.go plan.go verify.go restore.go project_restore.go
deploy/migrations/
deploy/runbooks/storage/
tests/storecontract/
tests/recovery/
```
```go
type ObjectStore interface {
    PutStaged(ctx context.Context, r io.Reader, expected Digest, limits PutLimits) (StagedObject, error)
    Verify(ctx context.Context, ref ObjectRef) (ObjectMetadata, error)
    Open(ctx context.Context, ref ObjectRef, byteRange *Range) (io.ReadCloser, ObjectMetadata, error)
    Promote(ctx context.Context, staged StagedObject, retention RetentionClass) (ObjectRef, error)
    DeleteStaged(ctx context.Context, staged StagedObject) error
    ListInventory(ctx context.Context, cursor string, limit int) (ObjectPage, error)
}

type UnitOfWork interface {
    Within(ctx context.Context, opts TxOptions, fn func(TxStores) error) error
}

type Migration struct {
    Version          int64
    Name             string
    Checksum         string
    MinReaderVersion int64
    MaxWriterVersion int64
    Apply            func(context.Context, Execer) error
    Verify           func(context.Context, Querier) error
}
```
ObjectStore implementations stream and enforce declared byte/media limits.
Application callers never receive adapter credentials or raw keys. Authorized
downloads are mediated by Omega or a short-lived, single-object, single-method
capability whose issuance and expiry are audited.
### Persistence support tables
```sql
CREATE TABLE schema_migrations (
    version          BIGINT PRIMARY KEY,
    name             TEXT NOT NULL,
    checksum         TEXT NOT NULL,
    state            TEXT NOT NULL,
    started_at       TIMESTAMP NOT NULL,
    finished_at      TIMESTAMP,
    applied_by       TEXT NOT NULL,
    safe_error_code  TEXT
);

CREATE TABLE file_objects (
    id               TEXT PRIMARY KEY,
    object_key       TEXT NOT NULL UNIQUE,
    sha256           TEXT NOT NULL,
    bytes            BIGINT NOT NULL,
    media_type       TEXT NOT NULL,
    state            TEXT NOT NULL,
    retention_class  TEXT NOT NULL,
    created_at       TIMESTAMP NOT NULL,
    activated_at     TIMESTAMP,
    deleted_at       TIMESTAMP,
    CHECK (state IN ('staged','active','quarantined','deleted'))
);

CREATE INDEX file_objects_digest ON file_objects(sha256, bytes);

CREATE TABLE backup_catalog (
    id                  TEXT PRIMARY KEY,
    kind                TEXT NOT NULL,
    database_marker     TEXT NOT NULL,
    schema_version      BIGINT NOT NULL,
    object_manifest_ref TEXT NOT NULL,
    status              TEXT NOT NULL,
    started_at          TIMESTAMP NOT NULL,
    finished_at         TIMESTAMP,
    verified_at         TIMESTAMP,
    safe_error_code     TEXT
);

CREATE TABLE restore_runs (
    id                 TEXT PRIMARY KEY,
    backup_id          TEXT NOT NULL,
    target_profile     TEXT NOT NULL,
    scope_kind         TEXT NOT NULL,
    scope_id           TEXT,
    status             TEXT NOT NULL,
    verification_json  TEXT NOT NULL,
    started_at         TIMESTAMP NOT NULL,
    finished_at        TIMESTAMP,
    safe_error_code    TEXT
);
```
If an existing File table already owns some metadata, migrate rather than
duplicate it. The invariant is one File/Object authority, not these exact
physical table names.
### PostgreSQL behavior
Use transaction isolation and explicit row/version predicates appropriate to
each invariant. Revision CAS remains the domain correctness authority; serial
execution of a connection is not. Retry only classified serialization/deadlock
errors around an idempotent unit-of-work closure. Use bounded pools with
timeouts, application name, statement/lock/idle-transaction limits, and
parameterized queries. Keyset pagination replaces offset for large mutable
sets. Job claims use atomic update/returning or `FOR UPDATE SKIP LOCKED` behind
the job store, not capability code.
Schema and indexes must support Project-bound lookup first, control-plane
principal lookup, lattice generation publication, file references, Workspace
action order, conversion/library idempotency, and audit/outbox sequence. Explain
plans for release queries are captured in the completion report.
### Migration sequence
1. Inventory every current table/query/transaction/migration and produce a
	canonical ownership map by package.
2. Freeze store-contract suites and seed corpora that cover all capabilities,
	Project isolation, jobs, libraries, control plane, conversion, and lattices.
3. Introduce PostgreSQL connection/transaction infrastructure, DDL generator or
	explicit migrations, and migration manifest/lock/checksum tooling.
4. Port foundational stores first: identity/Project/Resource/File/Activity/
	jobs/outbox, then capability stores, lattices, Workspace, conversions, and
	libraries.
5. Run each store contract and differential backend scenario against SQLite
	and PostgreSQL; prohibit behavior hidden in adapter conditionals.
6. Implement ObjectStore staging/promotion/open/inventory, migrate large bytes
	out of database/local-path assumptions, and validate references.
7. Implement clean install and SQLite-to-PostgreSQL development migration tool
	if current data must be preserved; verify counts, digests, IDs, revisions,
	and foreign-key ownership before cutover.
8. Implement backup catalog, database snapshot/PITR hooks, immutable object
	manifest, encryption/retention, full restore, and Project-scoped restore
	where feasible.
9. Add orphan/quarantine/reference/integrity jobs, dashboards, alerts, and
	recurring restore schedule.
10. Make PostgreSQL + object store the managed P1 readiness requirement. Keep
	SQLite D0 and gate any sealed production profile separately.
### Security, privacy, concurrency, idempotency, and observability
Database and object credentials are least-privilege, separately rotatable, and
never available to conversion/parser workers. TLS is required across
non-loopback storage connections. Backups are encrypted with separately
controlled keys and access. Restore environments are isolated and production
tokens/connectors/model credentials are disabled until verification and
promotion.
Object keys are opaque and do not contain user, Project, resource name, or
filename. Integrity is SHA-256 plus stored size/media policy. Access logs and
metrics contain IDs, counts, durations, result codes, WAL/backup markers, and
digests where safe—not content or original filenames.
Metrics cover DB pool/transaction/query/lock/deadlock/serialization behavior,
job claims, migration phase/lag, object put/open bytes/latency/errors, staged/
orphan/quarantine age, reference mismatch, backup age/duration/bytes, restore
age/duration/verification, and retention deletion. Alerts fire on failed
migration, backup age, unverified backup, object mismatch, outbox/job backlog,
pool exhaustion, and restore drill failure.
### Tests and failure drills
- Every store/UoW contract and backend E2E runs against both adapters; P1
	certification uses PostgreSQL.
- Concurrent revision CAS, Workspace ordering, grants, library publication,
	job/outbox claims, and conversion import commit under PostgreSQL races.
- Migration clean install, upgrade from every supported predecessor, checksum
	mismatch, concurrent migrator, crash mid-migration, verify failure, disk/
	connection loss, and supported rollback rehearsal.
- Object partial write, wrong digest/size/media, unavailable/corrupt object,
	promotion failure, DB rollback after staging, reaper crash, duplicate put,
	concurrent reference/delete, and credential revocation.
- Full backup during active writes followed by isolated restore and canonical
	demo. Verify object/reference watermark and last-good outbox/jobs.
- Project-scoped restore test proves no cross-Project overwrite and preserves
	stable IDs; if a safe scoped restore is not feasible in P1, document and test
	the full-restore/extract/reimport runbook instead of claiming it.
- PostgreSQL loss/restart, object-store loss/recovery, application crash after
	object staging and after DB commit, backup target outage, and key-unavailable
	drills.
- A sealed SQLite candidate, if offered, independently exercises WAL/checkpoint,
	backup API, corruption detection, file locking, full disk, concurrent jobs,
	restore, and capacity gates.
### Rollback and recovery
Prefer expand/verify/switch/contract migrations. Keep old columns/tables
read-compatible through a declared rollback window. Before an irreversible
contract migration: drain incompatible jobs, take and verify a backup, record
schema/worker versions, run preflight, and require explicit operator approval.
Rollback means deploying a compatible binary and data contract or restoring a
verified backup; it is never `git revert` against already-mutated data.
Objects are immutable, so rollback changes references and lifecycle rather than
rewriting bytes. Retain objects needed by the supported backup/rollback window.
Restored jobs/outbox events retain idempotency and are safe to replay.
### Completion evidence
- PostgreSQL is the default P1 configuration and all store contracts pass.
- Clean install, upgrade, supported rollback, full backup, isolated restore,
	and canonical backend verification are recorded with timings and manifests.
- Object storage is mandatory and no capability/worker relies on canonical
	local paths.
- Every backup in the release drill has a schema version, database marker,
	object manifest, encryption/retention record, and successful restore result.
- Migration/query-plan/integrity/recovery reports have no unresolved Critical
	or High issue.
- SQLite is labeled D0 unless its separate sealed-profile evidence exists.
### Dependencies
Depends on all canonical schemas from Ω-001 through Ω-041. Blocks Ω-043 and
Ω-044.
### Linked sources
- [Model — Workspace Capability & Runtime Contract](https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb)
- [Design — Multi-Lattice Ingestion Architecture](https://app.notion.com/p/3acb6410e50281bf8f16ec589da555d3)
- [Model — Structured Data Capability & Descriptor Lattice](https://app.notion.com/p/3acb6410e5028157b9e4e8228237cfb8)
- [Model — Media Capability & Descriptor Lattice](https://app.notion.com/p/3acb6410e50281dfa3abd6a5ed892917)


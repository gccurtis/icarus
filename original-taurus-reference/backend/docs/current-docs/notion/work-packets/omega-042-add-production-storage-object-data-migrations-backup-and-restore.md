---
title: "Work Packet — Ω-042 — Add production storage, object data, migrations, backup, and restore"
notion_page_id: "3acb6410e50281feba8ff4999d9d0505"
notion_url: "https://app.notion.com/3acb6410e50281feba8ff4999d9d0505"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:58:23Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-042 — Add production storage, object data, migrations, backup, and restore

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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


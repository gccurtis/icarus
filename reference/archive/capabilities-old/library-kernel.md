# Kernel — Icarus Library Asset, Version & Materialization Model

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e502814c9a0ad8d5f8e8b883).

## Prerequisites
### Required before implementation
- Platform Database transaction and migration interfaces.
- Platform Observability logger plus clock, identifier, canonical JSON, and digest utilities.
- Serial and concurrent job runtime with composition-owned internal stage dispatch.
### Provides downstream
- Stable asset identities, immutable version envelopes, lineage, and materialization receipts for Context, Templates, and Personas.
### Construction boundary
`1-init` constructs `SqliteLibraryRepository` with a store selected from top-level runtime configuration and injects attribution into the command service. Domain values, endpoint payloads, Jobs, and tables contain asset identities, not routing fields. Attribution is written by the initialized service and is never accepted from a request body.
## Purpose and authority
The Library Kernel is the shared envelope beneath typed reusable libraries. It owns:
- stable asset identity, kind, metadata, lifecycle, revision, and head version;
- append-only metadata ChangeSets and creation receipts;
- immutable version envelopes and exact source lineage;
- materialization identity, state, stage receipts, and final destination receipt;
- safe catalog and usage read models.
Context, Templates, and Personas own their payload schemas and tables. Destination capabilities own every object created or changed through materialization. The Kernel coordinates a transaction without decoding a typed payload.
## Runtime placement
```plain text
apps/backend/src/3-capabilities/library-kernel/
  domain/
    asset.ts
    version.ts
    lineage.ts
    materialization.ts
    operations.ts
    events.ts
  application/
    libraryKernel.ts
    metadataReducer.ts
    versionCoordinator.ts
    materializationCoordinator.ts
  ports/
    repository.ts
    typedPayloadParticipant.ts
  persistence/
    migrations.ts
    sqliteLibraryRepository.ts
  projections/
    assetCatalog.ts
    usageSummary.ts
  index.ts

apps/backend/src/4-job-wiring/
  internal/InternalJobDispatcher.ts
  library/registerLibraryEndpointMappings.ts
  library/createLibraryJobs.ts
```
`2-transport` parses requests. Job wiring creates Jobs and selects a queue. The capability owns domain decisions and persistence. A typed payload participant writes through the same `DatabaseTransaction` used by the Kernel.
## Core contracts
```typescript
export type LibraryAssetKind = "context" | "template" | "persona";
export type LibraryLifecycle = "active" | "trashed";

export interface LibraryAsset {
  id: string;
  kind: LibraryAssetKind;
  name: string;
  description: string;
  lifecycle: LibraryLifecycle;
  revision: number;
  headVersion: number;
  createdAt: string;
  updatedAt: string;
  trashedAt?: string;
}

export interface LibraryVersionEnvelope {
  assetId: string;
  version: number;
  payloadSchema: string;
  payloadDigest: string;
  createdAt: string;
}

export interface MaterializationTarget {
  kind: "context" | "resource" | "persona";
  targetId?: string;
  mode: "create" | "insert" | "copy";
}

export interface PublishLibraryVersion {
  assetId: string;
  expectedHeadVersion: number;
  clientRequestId: string;
  requestDigest: string;
}

export interface TypedPayloadParticipant<T> {
  prepare(input: T): Promise<{ payloadDigest: string; payloadSchema: string }>;
  write(transaction: DatabaseTransaction, assetId: string, version: number): Promise<void>;
}
```
`headVersion = 0` means no published payload exists. A published version becomes visible only when its typed payload, version envelope, and head update commit together.
## Operations and job classification
<table header-row="true">
<tr>
<td>Operation</td>
<td>Queue</td>
<td>Response</td>
<td>Commit</td>
</tr>
<tr>
<td>`library.asset.create`</td>
<td>Serial</td>
<td>Inline</td>
<td>Asset plus creation receipt</td>
</tr>
<tr>
<td>`library.asset.change-metadata`</td>
<td>Serial</td>
<td>Inline</td>
<td>ChangeSet plus folded asset</td>
</tr>
<tr>
<td>`library.asset.get`, `library.asset.list`, `library.version.get`</td>
<td>Concurrent</td>
<td>Inline</td>
<td>Read only</td>
</tr>
<tr>
<td>`library.version.publish`</td>
<td>Serial</td>
<td>Inline</td>
<td>Typed payload, envelope, head</td>
</tr>
<tr>
<td>`library.materialization.begin`</td>
<td>Serial</td>
<td>Inline receipt</td>
<td>Materialization plus plan-stage intent</td>
</tr>
<tr>
<td>typed conversion</td>
<td>Concurrent</td>
<td>Internal result</td>
<td>Durable stage result plus destination intent</td>
</tr>
<tr>
<td>destination command</td>
<td>Destination queue</td>
<td>Internal result</td>
<td>Destination-owned state</td>
</tr>
<tr>
<td>`library.materialization.settle`</td>
<td>Serial</td>
<td>Internal result</td>
<td>Final receipt or failure</td>
</tr>
</table>
A Job declares one queue. Multi-stage materialization therefore commits each stage independently and returns a typed `InternalStageIntent`. `InternalJobDispatcher` enqueues that intent only after commit.
## Mutation and idempotency model
Metadata commands carry `expectedRevision`, `clientRequestId`, and a canonical `requestDigest`. Within one transaction the repository:
1. returns the recorded result for the same request ID and digest;
2. rejects the same request ID with a different digest;
3. updates `library_assets` with `WHERE revision = expectedRevision`;
4. requires exactly one changed row;
5. appends the immutable forward and inverse operation at the new revision.
Publication uses the same law against `expectedHeadVersion`. The typed participant writes its payload before the head moves. Materialization stages use `(materialization_id, stage_key)` plus a request digest and revision CAS, so restart recovery can rediscover pending work without duplicating a destination mutation.
## SQLite schema
Logical table names are shown below. The repository maps them to any configuration-derived physical prefix when the Database adapter requires one.
```sql
PRAGMA foreign_keys = ON;

CREATE TABLE library_assets (
  asset_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('context', 'template', 'persona')),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  lifecycle TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active', 'trashed')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  head_version INTEGER NOT NULL DEFAULT 0 CHECK (head_version >= 0),
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  trashed_at TEXT,
  CHECK ((lifecycle = 'trashed' AND trashed_at IS NOT NULL) OR
         (lifecycle = 'active' AND trashed_at IS NULL))
) STRICT;

CREATE TABLE library_asset_changesets (
  asset_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  from_revision INTEGER NOT NULL CHECK (from_revision >= 0),
  to_revision INTEGER NOT NULL CHECK (to_revision > 0),
  client_request_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  forward_operation_json TEXT NOT NULL CHECK (json_valid(forward_operation_json)),
  inverse_operation_json TEXT NOT NULL CHECK (json_valid(inverse_operation_json)),
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (asset_id, revision),
  UNIQUE (asset_id, client_request_id),
  FOREIGN KEY (asset_id) REFERENCES library_assets(asset_id),
  CHECK (to_revision = revision AND to_revision = from_revision + 1)
) STRICT;

CREATE TABLE library_asset_creation_receipts (
  client_request_id TEXT PRIMARY KEY,
  request_digest TEXT NOT NULL,
  asset_id TEXT NOT NULL UNIQUE,
  response_json TEXT NOT NULL CHECK (json_valid(response_json)),
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (asset_id) REFERENCES library_assets(asset_id)
) STRICT;

CREATE TABLE library_asset_versions (
  asset_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  payload_schema TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  publish_request_id TEXT NOT NULL,
  publish_request_digest TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (asset_id, version),
  UNIQUE (asset_id, publish_request_id),
  FOREIGN KEY (asset_id) REFERENCES library_assets(asset_id)
) STRICT;

CREATE TABLE library_asset_lineage (
  asset_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_version INTEGER CHECK (source_version IS NULL OR source_version > 0),
  source_revision INTEGER CHECK (source_revision IS NULL OR source_revision >= 0),
  source_digest TEXT,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  PRIMARY KEY (asset_id, version, ordinal),
  FOREIGN KEY (asset_id, version)
    REFERENCES library_asset_versions(asset_id, version),
  CHECK (source_version IS NOT NULL OR source_revision IS NOT NULL)
) STRICT;

CREATE TABLE library_materializations (
  materialization_id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  source_version INTEGER NOT NULL CHECK (source_version > 0),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('context', 'resource', 'persona')),
  target_id TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('create', 'insert', 'copy')),
  state TEXT NOT NULL CHECK (state IN ('requested', 'running', 'succeeded', 'failed', 'canceled')),
  destination_id TEXT,
  warnings_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(warnings_json)),
  client_request_id TEXT NOT NULL UNIQUE,
  request_digest TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  actor_id TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (asset_id, source_version)
    REFERENCES library_asset_versions(asset_id, version),
  CHECK ((mode = 'insert' AND target_id IS NOT NULL) OR mode <> 'insert'),
  CHECK ((state = 'succeeded' AND destination_id IS NOT NULL) OR state <> 'succeeded')
) STRICT;

CREATE TABLE library_materialization_events (
  materialization_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  from_state TEXT,
  to_state TEXT NOT NULL CHECK (to_state IN ('requested', 'running', 'succeeded', 'failed', 'canceled')),
  event_kind TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (materialization_id, sequence),
  FOREIGN KEY (materialization_id)
    REFERENCES library_materializations(materialization_id),
  CHECK (from_state IS NULL OR from_state IN ('requested', 'running', 'succeeded', 'failed', 'canceled'))
) STRICT;

CREATE TABLE library_materialization_stages (
  materialization_id TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  queue TEXT NOT NULL CHECK (queue IN ('serial', 'concurrent')),
  state TEXT NOT NULL CHECK (state IN ('pending', 'running', 'succeeded', 'failed')),
  request_digest TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  claimed_at TEXT,
  PRIMARY KEY (materialization_id, stage_key),
  FOREIGN KEY (materialization_id)
    REFERENCES library_materializations(materialization_id),
  CHECK ((state = 'succeeded' AND result_json IS NOT NULL) OR state <> 'succeeded')
) STRICT;

CREATE INDEX library_assets_kind_updated
  ON library_assets(kind, updated_at DESC, asset_id);
CREATE INDEX library_assets_lifecycle_name
  ON library_assets(lifecycle, name COLLATE NOCASE, asset_id);
CREATE INDEX library_asset_changesets_tail
  ON library_asset_changesets(asset_id, revision DESC);
CREATE INDEX library_asset_creation_receipts_asset
  ON library_asset_creation_receipts(asset_id);
CREATE INDEX library_asset_versions_digest
  ON library_asset_versions(payload_digest, asset_id, version);
CREATE INDEX library_lineage_source
  ON library_asset_lineage(source_kind, source_id, source_version, source_revision);
CREATE INDEX library_materializations_asset_version
  ON library_materializations(asset_id, source_version, created_at DESC);
CREATE INDEX library_materializations_state_updated
  ON library_materializations(state, updated_at, materialization_id);
CREATE INDEX library_materialization_events_recent
  ON library_materialization_events(materialization_id, sequence DESC);
CREATE INDEX library_materialization_stages_pending
  ON library_materialization_stages(state, queue, updated_at, materialization_id);
```
The schema contains eight tables and ten explicit indexes. Cross-capability payload existence and destination identity are checked by typed participants inside the coordinating transaction. `actor_id`, `created_by`, and `updated_by` are injected attribution, not routing keys.
The CAS statements are part of the repository contract:
```sql
UPDATE library_assets
SET name = :name,
    description = :description,
    lifecycle = :lifecycle,
    revision = revision + 1,
    updated_by = :actor_id,
    updated_at = :updated_at,
    trashed_at = :trashed_at
WHERE asset_id = :asset_id
  AND revision = :expected_revision;

UPDATE library_assets
SET head_version = :next_version,
    updated_by = :actor_id,
    updated_at = :updated_at
WHERE asset_id = :asset_id
  AND head_version = :expected_head_version;
```
Each update must change exactly one row. A zero-row result is a revision conflict unless an earlier receipt proves an idempotent replay.
## Rebuildable read models
- `library_asset_catalog` joins asset metadata, its exact head envelope, and a safe typed summary. It may begin as a SQL view and later become a disposable table.
- `library_asset_usage_summary` aggregates successful materializations by asset, version, and destination kind.
These are derived read models, not canonical state. Ordinary SQL indexes are also rebuildable but do not constitute a domain projection.
## Narrow ports
The Kernel provides asset commands/readers, exact version readers, a transactional version coordinator, and a materialization coordinator. Typed libraries provide `TypedPayloadParticipant` and safe summary ports. Target capabilities receive only typed create or mutation commands and return their canonical destination identity.
## Invariants
1. Every asset has exactly one typed kind.
2. Every published envelope has one matching typed payload committed in the same transaction.
3. Published envelopes and accepted ChangeSets are immutable.
4. `head_version` advances monotonically to an existing version.
5. Metadata writes use revision CAS; publication uses head-version CAS.
6. A materialization pins one exact source version.
7. A successful materialization records the destination identity returned by its owning capability.
8. Repeating a request ID and digest returns the recorded result; changing the digest is an idempotency error.
9. Every stage commits before composition dispatches its next intent.
10. Trashing an asset preserves immutable history and prior materializations.
## Acceptance criteria
- Metadata replay and stale-revision behavior are deterministic.
- A typed payload failure rolls back its envelope and head update.
- Context, Templates, and Personas publish through the same coordinator without exposing payload bodies to the Kernel.
- Pending stages can be rediscovered after restart and dispatched without duplicating work.
- Catalog and usage read models rebuild entirely from canonical rows.
## References
- [Product — Icarus Complete Product Definition](../product/definition.md)
- [Model — Icarus Request, Job & Dual-Queue Runtime](../runtime/dual-queue.md)
- [Architecture — Icarus Runtime Foundation & Repository Boundaries](../runtime/repository-boundaries.md)

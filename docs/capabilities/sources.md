# Capability — Icarus Sources Runtime Model

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e502810aa6b9d46dca119589).

## Prerequisites
### Required before implementation
- SQLite, Logger, immutable blob storage, command receipts, and capability-owned Source history.
- Platform Web Retrieval for captured web material.
### Consumed when available
- Immutable snapshot adapters for Document, Slides, and Spreadsheet revisions enable native-Resource capture after those editors expose their public snapshot ports.
### Provides downstream
- Exact Source Versions and bounded read ports for Research, Evidence, Knowledge, Media, Context, and Import/Export.
### Construction boundary
The capability is constructed with a store already bound to the configured runtime scope. Domain values, endpoint payloads, jobs, and capability-owned tables use resource identities; scope routing remains in initialization. Accepted change records receive attribution from the initialized runtime.
Sources owns immutable project material and versions: uploaded general files, captured web pages, connector snapshots, and typed references to immutable native-Resource revisions. Document, Slides, and Spreadsheet capabilities own their editable Resources.
## Purpose and terminology
A Source is the stable origin used for retrieval and citation. A Source Version is the exact immutable material used at a particular moment.
<table fit-page-width="true" header-row="true">
<tr>
<td>Object</td>
<td>Owner</td>
</tr>
<tr>
<td>Document, Slides deck, Spreadsheet</td>
<td>Its editor capability</td>
</tr>
<tr>
<td>Uploaded PDF, Markdown, CSV, XLSX, image, or other general file</td>
<td>Sources</td>
</tr>
<tr>
<td>Captured web page</td>
<td>Sources</td>
</tr>
<tr>
<td>Connector item snapshot</td>
<td>Sources</td>
</tr>
<tr>
<td>Source-grounded assertion or quotation</td>
<td>Evidence</td>
</tr>
<tr>
<td>Text/embedding/lattice projection</td>
<td>Knowledge</td>
</tr>
</table>
Sources may register a `native_resource` Source Version that points to an exact editor revision. Mutation authority remains with the corresponding editor capability.
Sources is the only gateway by which native Document, Slides, or Spreadsheet content enters Knowledge: the owning editor exposes an immutable revision through a typed adapter, Sources records a closed `native_resource` subtype and Source Version, and Knowledge projects that Source Version. Data and Analysis remain direct-consumption inputs unless a caller explicitly captures their output as a Source Version or admits a grounded conclusion as Evidence.
Sources owns:
- Source identity, label, kind, lifecycle, and head version;
- immutable Source Versions, hashes, MIME/signature metadata, and locators;
- content-addressed blobs for general files and web snapshots;
- capture attempts and diagnostics;
- Source metadata/head change sets.
Knowledge owns text extraction and embeddings, Evidence owns grounded assertions, editor capabilities own editable state, Web Retrieval owns provider mechanics, and connector adapters own connector transport.
## Runtime placement
```plain text
apps/backend/src/3-capabilities/sources/
  domain/
    model.ts
    signatures.ts
  application/
    capture.ts
    service.ts
    snapshots.ts
  ports/
    repository.ts
    nativeResourceReaders.ts
  persistence/
    migrations/
      001-sources.ts
    sqliteSourcesRepository.ts
  index.ts

apps/backend/src/4-job-wiring/sources/
  registerSourceEndpointMappings.ts
  sourceJobFactories.ts
  sourceSnapshotAdapters.ts
```
Sources is composed into the backend. Immutable bytes live behind the capability-owned blob-store port; `SqliteSourcesRepository` stores them in `source_blobs`. The port also supports alternate durable blob adapters under the same Source contracts. Sources owns its migrations and persistence adapter. `1-init` receives the Platform Database handle, constructs the adapter, and injects it.
## Public operations
<table fit-page-width="true" header-row="true">
<tr>
<td>Operation</td>
<td>Effect</td>
</tr>
<tr>
<td>`sources.upload`</td>
<td>Validates, hashes, and creates an uploaded-file Source Version.</td>
</tr>
<tr>
<td>`sources.capture-web`</td>
<td>Retrieves and stores an exact web response plus normalized metadata.</td>
</tr>
<tr>
<td>`sources.register-resource-revision`</td>
<td>Registers an immutable reference to a Document/Slides/Spreadsheet revision.</td>
</tr>
<tr>
<td>`sources.refresh`</td>
<td>Captures a new version if content changed.</td>
</tr>
<tr>
<td>`sources.get` / `list`</td>
<td>Reads Source metadata.</td>
</tr>
<tr>
<td>`sources.get-version`</td>
<td>Returns immutable version metadata.</td>
</tr>
<tr>
<td>`sources.read-version`</td>
<td>Reads bounded exact bytes/text through the proper snapshot adapter.</td>
</tr>
<tr>
<td>`sources.rename`</td>
<td>Changes Source display metadata.</td>
</tr>
<tr>
<td>`sources.archive` / `restore`</td>
<td>Changes lifecycle while retaining immutable versions.</td>
</tr>
</table>
Connector sync uses the same `refresh` and version-publication contract after a connector adapter supplies a snapshot.
## Request-to-job mapping
<table fit-page-width="true" header-row="true">
<tr>
<td>Request</td>
<td>Queue</td>
<td>Response</td>
<td>Reason</td>
</tr>
<tr>
<td>rename, archive, restore, register native Resource revision</td>
<td>`serial`</td>
<td>`inline`</td>
<td>Small ordered canonical mutations.</td>
</tr>
<tr>
<td>upload</td>
<td>`concurrent`</td>
<td>`deferred`</td>
<td>Hashing, signature checks, and blob I/O can wait behind the bounded pool.</td>
</tr>
<tr>
<td>capture web / refresh connector</td>
<td>`concurrent`</td>
<td>`deferred`</td>
<td>External I/O; CAS and immutable versions make concurrent publication safe.</td>
</tr>
<tr>
<td>get/list/read</td>
<td>`concurrent`</td>
<td>`inline`</td>
<td>Independent reads.</td>
</tr>
</table>
Concurrent publication compares the Source revision observed at start, inserts immutable content by hash, and either advances the head atomically or returns a typed conflict or reuse result.
## Aggregate and change-set model
The mutable Source aggregate is metadata plus `currentVersionId`. Source Versions and blobs are immutable.
Every metadata change or head advance increments Source `revision` and appends a Source change set. Inverse operations restore a prior label, lifecycle, or head pointer while immutable versions remain retained. Capture attempts are append-only operational records.
## Core TypeScript model
```typescript
type SourceKind =
  | "uploaded_file"
  | "web_capture"
  | "connector_item"
  | "native_resource";

interface UploadMetadata {
  kind: "upload";
  originalFileName: string;
  detectedMimeType: string;
}

interface WebCaptureMetadata {
  kind: "web";
  requestedUrl: string;
  finalUrl: string;
  status: number;
  headers: Readonly<Record<string, string>>;
  retrievedAt: string;
}

interface ConnectorCaptureMetadata {
  kind: "connector";
  connectorKind: string;
  externalItemId: string;
  externalRevision: string;
}

interface NativeResourceCaptureMetadata {
  kind: "native_resource";
  resourceKind: "document" | "slides" | "spreadsheet";
  resourceId: string;
  resourceRevision: number;
}

interface Source {
  sourceId: string;
  revision: number;
  kind: SourceKind;
  label: string;
  lifecycle: "active" | "archived";
  canonicalUrl: string | null;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

type SourceStorage =
  | {
      kind: "blob";
      blobId: string;
    }
  | {
      kind: "native_resource";
      resource: {
        kind: "document" | "slides" | "spreadsheet";
        id: string;
        revision: number;
      };
    };

interface SourceVersion {
  sourceVersionId: string;
  sourceId: string;
  version: number;
  contentHash: string;
  mimeType: string;
  byteSize: number;
  storage: SourceStorage;
  captureMetadata:
    | WebCaptureMetadata
    | ConnectorCaptureMetadata
    | UploadMetadata
    | NativeResourceCaptureMetadata;
  locatorSchema: string;
  capturedAt: string;
}

type SourceVersionCandidate = Omit<
  SourceVersion,
  "sourceVersionId" | "version" | "capturedAt"
>;

interface ByteRange {
  start: number;
  end: number;
}

interface ExactSnapshot {
  bytes: Uint8Array;
  mimeType: string;
  contentHash: string;
  range: ByteRange;
}

type SourceOperation =
  | { kind: "set_label"; label: string }
  | { kind: "set_lifecycle"; lifecycle: Source["lifecycle"] }
  | { kind: "set_current_version"; sourceVersionId: string };

interface PublishSourceVersionRequest {
  sourceId: string;
  observedRevision: number;
  submissionId: string;
  candidate: SourceVersionCandidate;
}

type PublishSourceVersionResult =
  | { kind: "published"; source: Source; version: SourceVersion }
  | { kind: "reused"; source: Source; version: SourceVersion }
  | { kind: "revision_conflict"; actualRevision: number };
```
## Canonical SQLite schema
The Sources migration runs on a connection with `PRAGMA foreign_keys = ON`. The store is already configuration-bound. Source metadata is mutable under revision control; Source Versions and blob bytes are immutable. The storage discriminator makes blob-backed and native-Resource-backed versions mutually exclusive.
```sql
CREATE TABLE sources (
  source_id TEXT PRIMARY KEY
    CHECK (length(source_id) > 0),
  revision INTEGER NOT NULL
    CHECK (revision >= 1),
  kind TEXT NOT NULL
    CHECK (kind IN ('uploaded_file', 'web_capture', 'connector_item', 'native_resource')),
  label TEXT NOT NULL
    CHECK (length(trim(label)) > 0),
  lifecycle TEXT NOT NULL
    CHECK (lifecycle IN ('active', 'archived')),
  canonical_url TEXT,
  current_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (source_id, current_version_id),
  FOREIGN KEY (source_id, current_version_id)
    REFERENCES source_versions(source_id, source_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE source_blobs (
  blob_id TEXT PRIMARY KEY
    CHECK (length(blob_id) > 0),
  content_hash TEXT NOT NULL
    CHECK (length(content_hash) = 64 AND content_hash NOT GLOB '*[^0-9a-f]*'),
  mime_type TEXT NOT NULL
    CHECK (length(mime_type) > 0),
  byte_size INTEGER NOT NULL
    CHECK (byte_size >= 0),
  bytes BLOB NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (byte_size = length(bytes))
);

CREATE TABLE source_versions (
  source_version_id TEXT PRIMARY KEY
    CHECK (length(source_version_id) > 0),
  source_id TEXT NOT NULL,
  version INTEGER NOT NULL
    CHECK (version >= 1),
  content_hash TEXT NOT NULL
    CHECK (length(content_hash) = 64 AND content_hash NOT GLOB '*[^0-9a-f]*'),
  mime_type TEXT NOT NULL
    CHECK (length(mime_type) > 0),
  byte_size INTEGER NOT NULL
    CHECK (byte_size >= 0),
  storage_kind TEXT NOT NULL
    CHECK (storage_kind IN ('blob', 'native_resource')),
  blob_id TEXT,
  native_resource_kind TEXT
    CHECK (native_resource_kind IS NULL OR native_resource_kind IN ('document', 'slides', 'spreadsheet')),
  native_resource_id TEXT,
  native_resource_revision INTEGER
    CHECK (native_resource_revision IS NULL OR native_resource_revision >= 1),
  capture_kind TEXT NOT NULL
    CHECK (capture_kind IN ('upload', 'web', 'connector', 'native_resource')),
  capture_metadata_json TEXT NOT NULL
    CHECK (json_valid(capture_metadata_json) AND json_type(capture_metadata_json) = 'object'),
  locator_schema TEXT NOT NULL
    CHECK (length(locator_schema) > 0),
  captured_at TEXT NOT NULL,
  UNIQUE (source_id, source_version_id),
  UNIQUE (source_id, version),
  UNIQUE (source_id, content_hash),
  CHECK (
    (storage_kind = 'blob' AND blob_id IS NOT NULL
      AND native_resource_kind IS NULL
      AND native_resource_id IS NULL
      AND native_resource_revision IS NULL)
    OR
    (storage_kind = 'native_resource' AND blob_id IS NULL
      AND native_resource_kind IS NOT NULL
      AND native_resource_id IS NOT NULL
      AND native_resource_revision IS NOT NULL)
  ),
  CHECK (
    (capture_kind = 'native_resource' AND storage_kind = 'native_resource')
    OR
    (capture_kind IN ('upload', 'web', 'connector') AND storage_kind = 'blob')
  ),
  FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (blob_id)
    REFERENCES source_blobs(blob_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE source_capture_attempts (
  attempt_id TEXT PRIMARY KEY
    CHECK (length(attempt_id) > 0),
  source_id TEXT NOT NULL,
  submission_id TEXT NOT NULL
    CHECK (length(submission_id) > 0),
  capture_kind TEXT NOT NULL
    CHECK (capture_kind IN ('upload', 'web', 'connector', 'native_resource')),
  observed_revision INTEGER NOT NULL
    CHECK (observed_revision >= 0),
  status TEXT NOT NULL
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'interrupted')),
  request_json TEXT NOT NULL
    CHECK (json_valid(request_json) AND json_type(request_json) = 'object'),
  resulting_source_version_id TEXT,
  diagnostic_json TEXT
    CHECK (diagnostic_json IS NULL OR (json_valid(diagnostic_json) AND json_type(diagnostic_json) = 'object')),
  queued_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  UNIQUE (submission_id),
  UNIQUE (source_id, attempt_id),
  CHECK (
    (status = 'queued' AND started_at IS NULL AND finished_at IS NULL)
    OR (status = 'running' AND started_at IS NOT NULL AND finished_at IS NULL)
    OR (status IN ('succeeded', 'failed', 'cancelled', 'interrupted')
      AND started_at IS NOT NULL AND finished_at IS NOT NULL)
  ),
  CHECK (
    (status = 'succeeded' AND resulting_source_version_id IS NOT NULL)
    OR (status <> 'succeeded' AND resulting_source_version_id IS NULL)
  ),
  FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (source_id, resulting_source_version_id)
    REFERENCES source_versions(source_id, source_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE source_change_sets (
  change_set_id TEXT PRIMARY KEY
    CHECK (length(change_set_id) > 0),
  source_id TEXT NOT NULL,
  from_revision INTEGER NOT NULL
    CHECK (from_revision >= 0),
  to_revision INTEGER NOT NULL
    CHECK (to_revision = from_revision + 1),
  submission_id TEXT NOT NULL
    CHECK (length(submission_id) > 0),
  request_kind TEXT NOT NULL
    CHECK (request_kind IN (
      'create', 'publish_version', 'rename', 'archive', 'restore',
      'register_resource_revision', 'undo', 'redo'
    )),
  request_hash TEXT NOT NULL
    CHECK (length(request_hash) = 64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
  operations_json TEXT NOT NULL
    CHECK (json_valid(operations_json) AND json_type(operations_json) = 'array'),
  inverse_operations_json TEXT NOT NULL
    CHECK (json_valid(inverse_operations_json) AND json_type(inverse_operations_json) = 'array'),
  compensation_of_change_set_id TEXT,
  actor_id TEXT,
  committed_at TEXT NOT NULL,
  UNIQUE (source_id, to_revision),
  UNIQUE (source_id, submission_id),
  UNIQUE (source_id, change_set_id),
  FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (compensation_of_change_set_id)
    REFERENCES source_change_sets(change_set_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE source_command_receipts (
  submission_id TEXT PRIMARY KEY
    CHECK (length(submission_id) > 0),
  source_id TEXT,
  request_kind TEXT NOT NULL,
  request_hash TEXT NOT NULL
    CHECK (length(request_hash) = 64 AND request_hash NOT GLOB '*[^0-9a-f]*'),
  outcome TEXT NOT NULL
    CHECK (outcome IN ('accepted', 'rejected')),
  attempt_id TEXT,
  change_set_id TEXT,
  resulting_revision INTEGER,
  response_json TEXT,
  error_json TEXT,
  received_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  CHECK (
    (outcome = 'accepted' AND source_id IS NOT NULL
      AND resulting_revision IS NOT NULL
      AND response_json IS NOT NULL AND error_json IS NULL)
    OR
    (outcome = 'rejected' AND change_set_id IS NULL
      AND response_json IS NULL AND error_json IS NOT NULL)
  ),
  CHECK (response_json IS NULL OR json_valid(response_json)),
  CHECK (error_json IS NULL OR json_valid(error_json)),
  FOREIGN KEY (source_id)
    REFERENCES sources(source_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (source_id, attempt_id)
    REFERENCES source_capture_attempts(source_id, attempt_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (source_id, change_set_id)
    REFERENCES source_change_sets(source_id, change_set_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE UNIQUE INDEX source_blobs_hash
  ON source_blobs(content_hash);

CREATE INDEX sources_kind_updated
  ON sources(kind, lifecycle, updated_at DESC, source_id);

CREATE INDEX source_versions_number
  ON source_versions(source_id, version DESC);

CREATE INDEX source_versions_hash
  ON source_versions(content_hash, captured_at DESC);

CREATE UNIQUE INDEX source_versions_native_revision
  ON source_versions(native_resource_kind, native_resource_id, native_resource_revision)
  WHERE storage_kind = 'native_resource';

CREATE INDEX source_capture_attempts_source_recent
  ON source_capture_attempts(source_id, queued_at DESC, attempt_id);

CREATE INDEX source_capture_attempts_status
  ON source_capture_attempts(status, queued_at, attempt_id);

CREATE INDEX source_change_sets_revision
  ON source_change_sets(source_id, to_revision DESC);

CREATE INDEX source_change_sets_compensation
  ON source_change_sets(source_id, compensation_of_change_set_id)
  WHERE compensation_of_change_set_id IS NOT NULL;

CREATE INDEX source_receipts_outcome
  ON source_command_receipts(outcome, completed_at DESC);
```
### Atomic write protocol
A metadata mutation starts `BEGIN IMMEDIATE`, verifies the observed revision and request receipt, updates the Source head, then appends its ChangeSet and receipt. Capture jobs create an append-only attempt before external or blob work begins. Publication inserts or reuses content-addressed bytes, inserts or reuses the immutable Source Version, compare-and-swaps the Source head, completes the attempt, and writes the receipt in one final transaction. An unchanged capture may return an accepted receipt without a new ChangeSet. Only accepted ChangeSets carry `actor_id`.
### Relational guarantees
The schema contains **6 tables** and **10 explicit indexes**. Composite foreign keys guarantee that `current_version_id` and attempt results belong to their Source. The content-hash index deduplicates bytes within the configured store, while Source identity remains independent. The partial native-revision unique index gives each exact Document, Slides, or Spreadsheet revision one registered Source Version.
## Derived projections
Sources exposes the named **Source Version Inventory Projection**, rebuilt from canonical Source and Source Version rows for lists, head status, capture diagnostics, and downstream refresh selection. Knowledge, Data, and Media own extracted-text, descriptor, embedding, and lattice projections. A `content_hash` is canonical version identity.
## Dependencies and narrow ports
Sources uses:
- SQLite repository/blob store;
- editor-supplied `NativeResourceSnapshotReader` adapters;
- `WebPageFetcher` from `apps/backend/src/0-platform/web-retrieval`;
- connector snapshot readers supplied through composition.
Sources uses Platform Web Retrieval for web capture and the Platform Database for persistence.
Sources exposes:
```typescript
interface SourceSnapshotReader {
  getVersion(sourceVersionId: string): Promise<SourceVersionMetadata>;
  readExact(sourceVersionId: string, range?: ByteRange): Promise<ExactSnapshot>;
}
```
Research, Evidence, Knowledge, Media, Context, and Import/Export consume this read port. Source commands own mutation.
## Key flow
```mermaid
flowchart LR
  O[Upload, web page, connector item, or Resource revision] --> V[Validate and hash]
  V --> B[(Immutable blob or native revision ref)]
  B --> SV[Immutable Source Version]
  SV --> H[CAS advance Source head]
  H --> C[Exact citation and projection input]
```
## Invariants
1. A Source Version is immutable.
2. Every read addresses a stable `sourceVersionId` through the bound store.<br>3. General uploaded files are Sources; Document, Slides, and Spreadsheet are editable Resources.<br>4. Native Resource mutation remains with Document, Slides, or Spreadsheet.<br>5. Equal hashes in the configured store reuse one blob while preserving Source identities.<br>6. Head publication and its ChangeSet commit atomically.<br>7. Web captures store the material actually retrieved, retrieval time, final URL, status, and relevant headers.<br>8. Evidence and Knowledge pin an immutable Source Version.<br>9. Knowledge receives native editor content only through a typed `native_resource` Source Version.
3. Data and Analysis enter Knowledge through a Source Version or admitted Evidence.
4. Source capture treats content as inert data, enforces redirect and size bounds, and records retrieval metadata.
5. Archiving retains versions needed by historical Evidence.
## Acceptance criteria
- Uploading two identical files into the configured store reuses blob bytes while preserving two distinct Source identities.
- Refreshing unchanged material reuses the existing Source Version.
- A changed capture creates a new immutable version and atomically advances the head.
- A citation to an old version still reads the exact old bytes after refresh.
- Native Document, Slides, and Spreadsheet references read through editor-owned snapshot adapters; editor commands own mutation.
- Extracted representations remain owned by their projection capabilities.
## References
- [Design — Multi-Lattice Ingestion Architecture](https://app.notion.com/p/3acb6410e50281bf8f16ec589da555d3)
- [Design — Text Lattice Ingestion Pipeline](https://app.notion.com/p/3acb6410e50281d19635f051bb5ee6ad)
- [Architecture — Taurus Layered Application Model](https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f)
- [Product — Icarus Complete Product Definition](../product/definition.md)

# Capability — Sources

Sources owns immutable project material and versions: uploaded general files, captured web pages, connector snapshots, and typed references to immutable native-Resource revisions. Document, Slides, and Spreadsheet capabilities own their editable Resources.

## Purpose and terminology

A Source is the stable origin used for retrieval and citation. A Source Version is the exact immutable material used at a particular moment.

| Object | Owner |
|---|---|
| Document, Slides deck, Spreadsheet | Its editor capability |
| Uploaded PDF, Markdown, CSV, XLSX, image, or other general file | Sources |
| Captured web page | Sources |
| Connector item snapshot | Sources |
| Source-grounded assertion or quotation | Evidence |
| Text/embedding/lattice projection | Knowledge |

Sources may register a `native_resource` Source Version that points to an exact editor revision. Mutation authority remains with the corresponding editor capability.

Sources is the only gateway by which native Document, Slides, or Spreadsheet content enters Knowledge: the owning editor exposes an immutable revision through a typed adapter, Sources records a closed `native_resource` subtype and Source Version, and Knowledge projects that Source Version. Structured Data and Analysis remain direct-consumption inputs unless a user explicitly captures their output as a Source Version or admits a grounded conclusion as Evidence.

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

| Operation | Effect |
|---|---|
| `sources.upload` | Validates, hashes, and creates an uploaded-file Source Version. |
| `sources.capture-web` | Retrieves and stores an exact web response plus normalized metadata. |
| `sources.register-resource-revision` | Registers an immutable reference to a Document/Slides/Spreadsheet revision. |
| `sources.refresh` | Captures a new version if content changed. |
| `sources.get` / `list` | Reads Source metadata. |
| `sources.get-version` | Returns immutable version metadata. |
| `sources.read-version` | Reads bounded exact bytes/text through the proper snapshot adapter. |
| `sources.rename` | Changes Source display metadata. |
| `sources.archive` / `restore` | Changes lifecycle while retaining immutable versions. |

Connector sync uses the same `refresh` and version-publication contract after a connector adapter supplies a snapshot.

## Request-to-job mapping

| Request | Queue | Response | Reason |
|---|---|---|---|
| rename, archive, restore, register native Resource revision | `serial` | `inline` | Small ordered canonical mutations. |
| upload | `concurrent` | `deferred` | Hashing, signature checks, and blob I/O can wait behind the bounded pool. |
| capture web / refresh connector | `concurrent` | `deferred` | External I/O; CAS and immutable versions make concurrent publication safe. |
| get/list/read | `concurrent` | `inline` | Independent reads. |

Concurrent publication compares the Source revision observed at start, inserts immutable content by hash, and either advances the head atomically or returns a typed conflict or reuse result.

## Aggregate and change-set model

The mutable Source aggregate is metadata plus `currentVersionId`. Source Versions and blobs are immutable.

Every metadata change or head advance increments Source `revision` and appends a Source change set. Inverse operations restore a prior label, lifecycle, or head pointer while immutable versions remain retained. Capture attempts are append-only operational records.

## Core TypeScript model

```typescript
interface Scope {
  userId: string;
  projectId: string;
}

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
  userId: string;
  projectId: string;
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
  userId: string;
  projectId: string;
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
  scope: Scope;
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

## Canonical tables

```sql
CREATE TABLE sources (
  source_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1),
  kind TEXT NOT NULL CHECK (kind IN ('uploaded_file', 'web_capture', 'connector_item', 'native_resource')),
  label TEXT NOT NULL,
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('active', 'archived')),
  canonical_url TEXT,
  current_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, project_id, source_id),
  FOREIGN KEY (user_id, project_id, source_id, current_version_id)
    REFERENCES source_versions(user_id, project_id, source_id, source_version_id)
);

CREATE TABLE source_blobs (
  blob_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  bytes BLOB NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, project_id, blob_id)
);

CREATE TABLE source_versions (
  source_version_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  storage_kind TEXT NOT NULL CHECK (storage_kind IN ('blob', 'native_resource')),
  blob_id TEXT,
  native_resource_kind TEXT
    CHECK (native_resource_kind IN ('document', 'slides', 'spreadsheet')),
  native_resource_id TEXT,
  native_resource_revision INTEGER,
  capture_metadata_json TEXT NOT NULL DEFAULT '{}',
  locator_schema TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  CHECK (
    (
      storage_kind = 'blob'
      AND blob_id IS NOT NULL
      AND native_resource_kind IS NULL
      AND native_resource_id IS NULL
      AND native_resource_revision IS NULL
    )
    OR (
      storage_kind = 'native_resource'
      AND blob_id IS NULL
      AND native_resource_kind IS NOT NULL
      AND native_resource_id IS NOT NULL
      AND native_resource_revision IS NOT NULL
    )
  ),
  UNIQUE (user_id, project_id, source_id, source_version_id),
  FOREIGN KEY (user_id, project_id, source_id)
    REFERENCES sources(user_id, project_id, source_id),
  FOREIGN KEY (user_id, project_id, blob_id)
    REFERENCES source_blobs(user_id, project_id, blob_id)
);

CREATE TABLE source_capture_attempts (
  attempt_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  source_id TEXT,
  kind TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  requested_locator_json TEXT NOT NULL,
  status TEXT NOT NULL,
  diagnostic_json TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  FOREIGN KEY (user_id, project_id, source_id)
    REFERENCES sources(user_id, project_id, source_id)
);

CREATE TABLE source_change_sets (
  change_set_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  base_revision INTEGER NOT NULL,
  submission_id TEXT NOT NULL,
  operations_json TEXT NOT NULL,
  inverse_json TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  FOREIGN KEY (user_id, project_id, source_id)
    REFERENCES sources(user_id, project_id, source_id)
);
```

Exact indexes:

```sql
CREATE INDEX sources_project_kind_updated
  ON sources(user_id, project_id, lifecycle, kind, updated_at DESC, source_id);

CREATE UNIQUE INDEX source_blobs_project_hash
  ON source_blobs(user_id, project_id, sha256);

CREATE UNIQUE INDEX source_versions_number
  ON source_versions(user_id, project_id, source_id, version);

CREATE INDEX source_versions_hash
  ON source_versions(user_id, project_id, source_id, content_hash, source_version_id);

CREATE UNIQUE INDEX source_versions_native_revision
  ON source_versions(user_id, project_id, native_resource_kind, native_resource_id, native_resource_revision)
  WHERE native_resource_id IS NOT NULL;

CREATE INDEX source_capture_attempts_source_recent
  ON source_capture_attempts(user_id, project_id, source_id, started_at DESC, attempt_id);

CREATE INDEX source_capture_attempts_status
  ON source_capture_attempts(user_id, project_id, status, started_at, attempt_id);

CREATE UNIQUE INDEX source_capture_attempts_submission
  ON source_capture_attempts(user_id, project_id, submission_id);

CREATE UNIQUE INDEX source_change_sets_revision
  ON source_change_sets(user_id, project_id, source_id, revision);

CREATE UNIQUE INDEX source_change_sets_submission
  ON source_change_sets(user_id, project_id, source_id, submission_id);
```

Every Source-owned child repeats `user_id + project_id` and references a parent key carrying the same scope. `source_versions` binds Source identity into the key used by `sources.current_version_id`. Native Resource identity is exactly `(native_resource_kind, native_resource_id, native_resource_revision)` and the subtype is closed to `document | slides | spreadsheet`.

## Derived projections

Sources exposes the named **Source Version Inventory Projection**, rebuilt from canonical Source and Source Version rows for lists, head status, capture diagnostics, and downstream refresh selection. Knowledge, Structured Data, and Media own extracted-text, descriptor, embedding, and lattice projections. A `content_hash` is canonical version identity.

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
  getVersion(scope: Scope, sourceVersionId: string): Promise<SourceVersionMetadata>;
  readExact(scope: Scope, sourceVersionId: string, range?: ByteRange): Promise<ExactSnapshot>;
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
2. Every read is scoped by `userId + projectId + sourceVersionId`.
3. General uploaded files are Sources; Document, Slides, and Spreadsheet are editable Resources.
4. Native Resource mutation remains with Document, Slides, or Spreadsheet.
5. Equal project-scoped hashes reuse one blob while preserving Source identities.
6. Head publication and its change set commit atomically.
7. Web captures store the material actually retrieved, retrieval time, final URL, status, and relevant headers.
8. Evidence and Knowledge pin an immutable Source Version.
9. Knowledge receives native editor content only through a typed `native_resource` Source Version.
10. Structured Data and Analysis enter Knowledge through a Source Version or admitted Evidence.
11. Source capture treats content as inert data, enforces redirect and size bounds, and records retrieval metadata.
12. Archiving retains versions needed by historical Evidence.

## Acceptance criteria

- Uploading two identical files within the same project reuses blob bytes while preserving two distinct Source identities.
- Refreshing unchanged material reuses the existing Source Version.
- A changed capture creates a new immutable version and atomically advances the head.
- A citation to an old version still reads the exact old bytes after refresh.
- Native Document, Slides, and Spreadsheet references read through editor-owned snapshot adapters; editor commands own mutation.
- Extracted representations remain owned by their projection capabilities.

## References

- [Design — Multi-Lattice Ingestion Architecture](https://app.notion.com/p/3acb6410e50281bf8f16ec589da555d3)
- [Design — Text Lattice Ingestion Pipeline](https://app.notion.com/p/3acb6410e50281d19635f051bb5ee6ad)
- [Architecture — Taurus Layered Application Model](https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f)
- [Product — Icarus Complete Product Definition](https://app.notion.com/p/3aeb6410e502810ba9c0c26442d5255a)

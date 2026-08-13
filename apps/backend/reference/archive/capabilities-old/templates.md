# Capability — Icarus Templates Runtime Model

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e50281eabd5fe3c833fbeb73).

## Prerequisites
### Required before implementation
- Library Kernel asset, version, lineage, and materialization coordinators.
- Context exact-version binding reader.
- Formula plus the Data resolver adapter used to evaluate named bindings.
- Canonical create and mutation ports for Document, Slides, and Spreadsheet.
- Platform Database, logger, canonical digest utilities, and the dual-queue job runtime.
### Provides downstream
- Exact Template draft/version readers, previews, and typed materialization plans for editor creation and insertion workflows.
### Construction boundary
`1-init` injects a bound repository, attribution, the Library participant, binding readers, and editor adapters. Template requests and tables carry asset and Resource identities only. Preview values are explicit ephemeral input and never become canonical Template state.
## Purpose and authority
Templates owns reusable structures for exactly one native Resource kind: Document, Slides, or Spreadsheet. It owns:
- one mutable typed draft per Template asset;
- ordered binding slots with stable IDs;
- append-only draft ChangeSets with exact inverses;
- strict per-kind validation, migration, and sanitization;
- immutable published payloads;
- replaceable previews and typed materialization plans.
The Library Kernel owns the asset envelope, immutable version number, lineage, and materialization receipt. Each destination capability validates and commits its own state and ChangeSet.
## Runtime placement
```plain text
apps/backend/src/3-capabilities/templates/
  domain/
    template.ts
    slots.ts
    operations.ts
    events.ts
  application/
    templateService.ts
    reducer.ts
    publisher.ts
    previewService.ts
    materializationPlanner.ts
  adapters/
    registry.ts
    documentTemplateAdapter.ts
    slidesTemplateAdapter.ts
    spreadsheetTemplateAdapter.ts
  ports/
    libraryKernel.ts
    contextReader.ts
    formulaResolver.ts
    resourceTemplateAdapters.ts
    repository.ts
  persistence/
    migrations.ts
    sqliteTemplateRepository.ts
  projections/
    previewCache.ts
    compatibilityCatalog.ts
  index.ts

apps/backend/src/4-job-wiring/templates/
  registerTemplateEndpointMappings.ts
  createTemplateJobs.ts
```
Adapters are transport-neutral. Job wiring creates public and internal Jobs; it is the only layer that invokes the Scheduler.
## Domain contracts
```typescript
export type TemplateKind = "document" | "slides" | "spreadsheet";

export interface TemplateSlot {
  id: string;
  name: string;
  description: string;
  required: boolean;
  acceptedBindingKinds: Array<"context" | "source" | "resource">;
}

export interface TemplateDraft {
  assetId: string;
  kind: TemplateKind;
  revision: number;
  baseSequence: number;
  schemaVersion: number;
  slots: TemplateSlot[];
  payload: unknown;
  payloadDigest: string;
  updatedAt: string;
}

export interface PublishedTemplatePayload {
  assetId: string;
  version: number;
  sourceDraftRevision: number;
  kind: TemplateKind;
  schemaVersion: number;
  slots: TemplateSlot[];
  payload: unknown;
  payloadDigest: string;
}

export interface TemplateKindAdapter<DraftPayload, Snapshot, CreateCommand, InsertCommand> {
  readonly kind: TemplateKind;
  validateDraft(payload: DraftPayload, slots: readonly TemplateSlot[]): ValidationResult;
  sanitizeForPublish(payload: DraftPayload): Snapshot;
  preview(input: TemplatePreviewInput<Snapshot>): Promise<TemplatePreview>;
  planCreate(input: MaterializeCreateInput<Snapshot>): Promise<CreateCommand>;
  planInsert(input: MaterializeInsertInput<Snapshot>): Promise<InsertCommand>;
  remapIds(snapshot: Snapshot, ids: IdFactory): Snapshot;
}
```
`payload` is unknown only at the adapter registry boundary. A registered adapter must decode it into its strict schema before validation, preview, publication, or materialization.
## Operations and job classification
<table header-row="true">
<tr>
<td>Operation</td>
<td>Queue</td>
<td>Response</td>
<td>Effect</td>
</tr>
<tr>
<td>`templates.create`</td>
<td>Serial</td>
<td>Inline</td>
<td>Asset plus blank typed draft</td>
</tr>
<tr>
<td>`templates.submit`</td>
<td>Serial</td>
<td>Inline</td>
<td>ChangeSet plus folded draft under CAS</td>
</tr>
<tr>
<td>`templates.get`, `templates.list`, `templates.version.get`</td>
<td>Concurrent</td>
<td>Inline</td>
<td>Exact draft or version read</td>
</tr>
<tr>
<td>`templates.publish`</td>
<td>Serial</td>
<td>Inline</td>
<td>Typed payload plus Library envelope</td>
</tr>
<tr>
<td>`templates.preview`</td>
<td>Concurrent</td>
<td>Inline when bounded</td>
<td>Ephemeral preview</td>
</tr>
<tr>
<td>`templates.preview.request`</td>
<td>Concurrent</td>
<td>Deferred</td>
<td>Replaceable preview artifact</td>
</tr>
<tr>
<td>`templates.materialize.create`, `templates.materialize.insert`</td>
<td>Serial</td>
<td>Deferred</td>
<td>Receipt plus planning intent</td>
</tr>
<tr>
<td>planning</td>
<td>Concurrent</td>
<td>Internal result</td>
<td>Typed destination command intent</td>
</tr>
<tr>
<td>destination mutation and settlement</td>
<td>Serial stages</td>
<td>Internal results</td>
<td>Destination commit, then receipt settlement</td>
</tr>
</table>
Materialization is an explicit workflow because each Job selects one queue. Every stage uses a deterministic stage key and request digest; a stage commits before its next intent is dispatched.
## Draft, publication, and materialization law
```typescript
export type TemplateOperation =
  | { type: "slot.add"; slot: TemplateSlot; index: number }
  | { type: "slot.update"; slotId: string; patch: TemplateSlotPatch }
  | { type: "slot.move"; slotId: string; toIndex: number }
  | { type: "slot.remove"; slotId: string }
  | { type: "payload.apply"; operation: TemplateKindOperation }
  | { type: "draft.replace"; schemaVersion: number; payload: unknown };
```
Every submit command carries `expectedRevision`, `clientRequestId`, and `requestDigest`. The reducer applies the operation to a copy, validates the complete result, computes the inverse, then atomically inserts the ChangeSet and updates the draft with `WHERE revision = expectedRevision`. An identical retry returns the accepted ChangeSet; a changed digest is an idempotency error.
Publishing pins an exact draft revision, validates every slot and internal reference, sanitizes editor-transient state, computes a canonical digest, and asks the Library Kernel to publish `head + 1`. The typed payload and envelope commit together. The draft and its history remain available.
Materialization always pins a published version. Adapters remove transient editor state, collaboration state, prior ChangeSets, resolved bindings, expiring URLs, and source Resource identifiers that must be regenerated. Create mode allocates fresh destination IDs. Insert mode emits ordinary destination operations against an expected destination revision.
## SQLite schema
```sql
PRAGMA foreign_keys = ON;

CREATE TABLE template_drafts (
  asset_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('document', 'slides', 'spreadsheet')),
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  base_sequence INTEGER NOT NULL DEFAULT 0 CHECK (base_sequence >= 0),
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  slots_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(slots_json)),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  payload_digest TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (asset_id) REFERENCES library_assets(asset_id),
  CHECK (base_sequence <= revision)
) STRICT;

CREATE TABLE template_changesets (
  asset_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  from_revision INTEGER NOT NULL CHECK (from_revision >= 0),
  to_revision INTEGER NOT NULL CHECK (to_revision > 0),
  client_request_id TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  forward_operation_json TEXT NOT NULL CHECK (json_valid(forward_operation_json)),
  inverse_operation_json TEXT NOT NULL CHECK (json_valid(inverse_operation_json)),
  result_digest TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (asset_id, revision),
  UNIQUE (asset_id, client_request_id),
  FOREIGN KEY (asset_id) REFERENCES template_drafts(asset_id),
  CHECK (to_revision = revision AND to_revision = from_revision + 1)
) STRICT;

CREATE TABLE template_version_payloads (
  asset_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  source_draft_revision INTEGER NOT NULL CHECK (source_draft_revision >= 0),
  kind TEXT NOT NULL CHECK (kind IN ('document', 'slides', 'spreadsheet')),
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  slots_json TEXT NOT NULL CHECK (json_valid(slots_json)),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  payload_digest TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (asset_id, version),
  FOREIGN KEY (asset_id, version)
    REFERENCES library_asset_versions(asset_id, version)
) STRICT;

CREATE TABLE template_preview_cache (
  cache_key TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('draft', 'version')),
  source_pointer INTEGER NOT NULL CHECK (source_pointer >= 0),
  binding_digest TEXT NOT NULL,
  adapter_version TEXT NOT NULL,
  format TEXT NOT NULL,
  preview_json TEXT CHECK (preview_json IS NULL OR json_valid(preview_json)),
  artifact_blob BLOB,
  media_type TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (asset_id) REFERENCES library_assets(asset_id),
  UNIQUE (asset_id, source_kind, source_pointer, binding_digest, adapter_version, format),
  CHECK ((preview_json IS NOT NULL) <> (artifact_blob IS NOT NULL)),
  CHECK ((artifact_blob IS NULL AND media_type IS NULL) OR
         (artifact_blob IS NOT NULL AND media_type IS NOT NULL)),
  CHECK ((source_kind = 'version' AND source_pointer > 0) OR source_kind = 'draft')
) STRICT;

CREATE INDEX template_drafts_kind_updated
  ON template_drafts(kind, updated_at DESC, asset_id);
CREATE INDEX template_changesets_tail
  ON template_changesets(asset_id, revision DESC);
CREATE INDEX template_version_payloads_kind_created
  ON template_version_payloads(kind, created_at DESC, asset_id, version);
CREATE INDEX template_version_payloads_digest
  ON template_version_payloads(payload_digest, asset_id, version);
CREATE INDEX template_preview_cache_expiry
  ON template_preview_cache(expires_at, cache_key);
```
The schema contains four tables and five explicit indexes. The Library transaction verifies asset kind and advances the matching envelope. The repository performs draft CAS with a guarded `UPDATE`; zero changed rows means conflict unless the request receipt identifies a replay.
## Rebuildable read models
- `template_preview` is the cached render of an exact draft revision or published version, exact binding digest, and adapter version.
- `template_compatibility_catalog` derives legal destination modes from Template kind, schema version, registered adapter, and destination command support.
Both can be deleted and regenerated from canonical payloads and adapter registrations.
## Narrow ports
Templates consumes Library coordination, exact Context bindings, a Formula resolver snapshot, and the three destination command ports. It provides exact readers, `TemplatePreviewPort`, `TemplateMaterializationPlanner`, and a safe summary provider for the Library catalog.
Adapters may emit only the destination capability’s public commands:
- `CreateDocumentFromSnapshot` or `ApplyDocumentOperations`;
- `CreateDeckFromSnapshot` or `ApplyDeckOperations`;
- `CreateSpreadsheetFromSnapshot` or `ApplySpreadsheetOperations`.
## Invariants
1. Every Template belongs to one Library asset of kind `template`.
2. Every draft and published payload has exactly one Resource kind.
3. Slot IDs are stable and unique within a Template.
4. Renaming a slot rewrites its typed internal references atomically.
5. Draft mutations use revision CAS and append immutable forward and inverse operations.
6. Published payloads are immutable and content-addressed.
7. Preview bindings remain ephemeral.
8. Materialization pins an exact published version.
9. Create mode generates every destination-local identity anew.
10. Insert mode commits ordinary destination ChangeSets against an expected revision.
11. Each workflow stage is idempotent by materialization ID, stage key, and digest.
## Acceptance criteria
- ChangeSet replay yields the same folded draft.
- A stale revision leaves draft state unchanged.
- Publishing writes the Library envelope and typed payload atomically.
- Document, Slides, and Spreadsheet materialize through one adapter registry.
- Preview and compatibility read models rebuild from canonical state.
- Duplicate materialization returns the existing destination result.
## References
- [Product — Icarus Complete Product Definition](../product/definition.md)
- [Model — Icarus Request, Job & Dual-Queue Runtime](../runtime/dual-queue.md)
- [Architecture — Icarus Runtime Foundation & Repository Boundaries](../runtime/repository-boundaries.md)

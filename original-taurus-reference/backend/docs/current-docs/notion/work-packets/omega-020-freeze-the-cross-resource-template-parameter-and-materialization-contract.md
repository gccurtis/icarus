---
title: "Work Packet — Ω-020 — Freeze the cross-resource Template parameter and materialization contract"
notion_page_id: "3acb6410e502812eb0f3f4aca7e329be"
notion_url: "https://app.notion.com/3acb6410e502812eb0f3f4aca7e329be"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:59:20Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-020 — Freeze the cross-resource Template parameter and materialization contract

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

**Type:** Supporting  
**Wave:** 2 — Implement every resource capability  
**Gate:** Project Backend Complete  
**Depends on:** Ω-001, Ω-015, Ω-017  
**Unblocks:** Ω-022, Ω-024, Ω-026, Ω-038, Ω-039
## Outcome
Taurus has one versioned, resource-neutral contract for capturing a reusable
template, declaring its parameters/context slots, previewing it, and
materializing a copy as either a new Resource or content inserted into an
existing compatible Resource.
The contract supports:
- a whole Document or a selected Document section;
- a whole Spreadsheet or one sheet inserted as a new sheet;
- a whole Slides deck or one slide;
- a Chat prompt/turn pattern;
- stable parameters that can bind literal values, Context, Resources, or Files.
Templates are copies, not live links. Editing a library template does not mutate
past materializations or its source Project. Lineage remains inspectable.
## Current evidence
- Current Omega exposes `GET /documents/templates` over Project Documents
	marked as templates.
- No Template capability, stable Template ID/version, parameter schema,
	materialization port, cross-resource target, or user-level library exists.
- `resource.Kind` anticipates multiple editor resources, but wiring currently
	registers Document and Connector families only.
- The Taurus Alpha Template Library mock expects Prompt/Content preview,
	parameterized Context slots, sharing, provenance, and “Bring into project.”
- User-level library ownership and sharing are intentionally deferred to
	Ω-038–Ω-039. This packet freezes a scope-neutral model now so that move is a
	storage/authorization change rather than a content rewrite.
## Before and after
```plain text
Before
Document.is_template + project-local listing
  └── no shared schema, insertion contract, version, or lineage

After
core/capability/template/
  model.go          immutable definitions and versions
  parameters.go     typed slot schema and validation
  materialize.go    target-neutral plan/receipt
  ports.go          resource-family capture/materialize ports
  errors.go

core/platform/storage/sqlite/
  sqlite_template.go
```
## Scope
- Freeze domain vocabulary and JSON schemas.
- Implement Project-scoped storage sufficient for Wave 2.
- Define capture, preview, validation, and materialization ports.
- Define lineage and copy semantics.
- Adapt current Document templates without changing visible behavior.
- Publish internal transport contracts used by each resource packet.
## Non-goals
- No user/organization libraries, marketplace, discovery ranking, or external
	sharing; Ω-038–Ω-039 own those.
- No template editor UI.
- No cross-resource conversion: a Slide template cannot materialize into a
	Spreadsheet.
- No live inheritance or automatic propagation to copies.
- No Office-file parsing.
## Governing invariants
1. A Template Version is immutable.
2. A materialization resolves exactly one Template Version.
3. Template identity and ownership scope are separate from destination Project
	scope.
4. Destination Project ID and actor come from trusted access context.
5. Parameters are declared and typed; undeclared input is rejected.
6. Secret values are references, never persisted in template content or
	receipts.
7. Materialization is idempotent by \`(destination, template_version,
	idempotency_key)\`.
8. Generated object IDs are new, while internal references are remapped
	consistently.
9. Source access, Template access, parameter-value access, and destination write
	access are re-authorized at execution time.
10. A copy preserves lineage but gains no continuing permission through its
	origin.
## Core model
```go
type TemplateKind string

const (
    TemplateDocument    TemplateKind = "document"
    TemplateSpreadsheet TemplateKind = "spreadsheet"
    TemplateSlides      TemplateKind = "slides"
    TemplateChat        TemplateKind = "chat"
)

type LibraryScope struct {
    Kind string // project now; user | organization later
    ID   string
}

type Template struct {
    ID             string
    Scope          LibraryScope
    Kind           TemplateKind
    Name           string
    Description    string
    CurrentVersion int64
    CreatorID      string
    CreatedAt      time.Time
    UpdatedAt      time.Time
}

type TemplateVersion struct {
    TemplateID    string
    Version       int64
    Capture       CaptureRef
    Content       json.RawMessage
    Parameters    []ParameterDefinition
    ContentHash   string
    SchemaVersion int
    CreatedBy     string
    CreatedAt     time.Time
}

type ParameterDefinition struct {
    Key         string
    Label       string
    Description string
    Type        string // text | number | boolean | date | context | resource | file
    Required    bool
    Multiple    bool
    Default     *ParameterValue
    Constraints json.RawMessage
}

type MaterializeTarget struct {
    Mode       string // new_resource | insert
    ProjectID  string
    Kind       TemplateKind
    ResourceID string
    ParentID   string // section/sheet/slide/turn insertion context
    Position   *int
}

type MaterializationReceipt struct {
    ID              string
    TemplateID      string
    TemplateVersion int64
    Target          MaterializeTarget
    ResultRefs      []ResourceObjectRef
    IdempotencyKey  string
    CreatedBy       string
    CreatedAt       time.Time
}
```
Resource families implement:
```go
type TemplateFamily interface {
    Kind() TemplateKind
    Capture(ctx context.Context, source CaptureRef) (CapturedContent, error)
    Validate(content CapturedContent, params []ParameterDefinition) error
    Preview(ctx context.Context, version TemplateVersion) (Preview, error)
    Materialize(
        ctx context.Context,
        version TemplateVersion,
        target MaterializeTarget,
        values map[string]ParameterValue,
    ) (MaterializationResult, error)
}
```
## Persistence
```sql
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  scope_kind TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  current_version INTEGER NOT NULL,
  creator_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_templates_scope
  ON templates(scope_kind, scope_id, kind, updated_at);

CREATE TABLE template_versions (
  template_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  capture_json TEXT NOT NULL,
  content_json TEXT NOT NULL,
  parameters_json TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(template_id, version),
  FOREIGN KEY(template_id) REFERENCES templates(id) ON DELETE CASCADE
);

CREATE TABLE template_materializations (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  destination_project_id TEXT NOT NULL,
  target_json TEXT NOT NULL,
  result_refs_json TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(destination_project_id, idempotency_key)
);
```
## HTTP and operation contracts
Wave 2 may keep these Project-scoped:
```javascript
POST /templates
GET  /templates
GET  /templates/:templateID
POST /templates/:templateID/versions
POST /templates/:templateID/preview
POST /templates/:templateID/materializations
GET  /template-materializations/:receiptID
```
Responses use stable `code` fields for incompatible target, missing parameter,
invalid value, stale source, inaccessible source, conflict, and idempotency
mismatch.
## Ordered implementation tasks
1. Freeze schemas and canonical JSON/hash rules with golden fixtures for all four
	kinds.
2. Add the capability, Project-scoped SQLite store, and store-contract suite.
3. Add a registry in wiring; Template never imports editor capabilities.
4. Implement Document capture/materialization and adapt the current template
	flag/listing.
5. Add preview and validation ports with bounded responses.
6. Add idempotent materialization receipts and lineage.
7. Add routes, authorization, operation-mode classification, and resource
	access checks.
8. Add migration adapters used by Ω-039 to move ownership without rewriting
	versions.
9. Update architecture and reference companions.
## Security, concurrency, jobs, and observability
- Materialization into an existing resource uses that aggregate's revision/CAS
	contract and returns a conflict instead of overwriting.
- Large captures/materializations are durable jobs; small ones may stay inline,
	but operation classification is explicit.
- Template content must not include access grants, session state, provider
	credentials, hidden model reasoning, or transient editor state.
- Validate embedded File and Resource references and clone/reference them
	according to explicit policy.
- Emit capture/materialize counts, kind, version, duration, object count, bytes,
	conflict, idempotent replay, and failure code; never parameter values.
## Verification
- Golden schema and hash stability across versions.
- Capture/materialize round trip for each supported granularity.
- Parameter validation, reference remapping, and deterministic preview.
- Idempotency replay and mismatched-payload conflict.
- Negative security for inaccessible source/template/parameter/destination.
- Concurrent materializations and insert-at-revision conflicts.
- Migration compatibility with current Document template listing.
- Backend E2E: save, preview, fill, materialize, inspect lineage.
## Migration and rollback
Expand with the new tables; adapt legacy Document templates into v1 versions
without deleting the old marker. Compare both listings, switch reads, then
retire the old special path only after Ω-017 and its rollback window. Template
versions and receipts are additive; rollback leaves them parked.
## Completion evidence
- JSON schemas and example payloads are published.
- All four `TemplateFamily` conformance tests pass, even if later packets still
	provide stubbed unsupported operations before their own completion.
- Document compatibility and materialization E2E pass.
- License inventory shows no non-FOSS dependency.
## Sources
- Taurus Yesod Template Library and resource model pages
- `core/capability/document`
- `core/capability/resource`
- `core/handlers/document`
- `core/wiring/resource_generator.go`
---


---
title: "Execute Ω-020 — Freeze the cross-resource Template parameter and materialization contract"
packet_id: "Ω-020"
status: "ready-for-execution"
wave: "Wave 2 — Implement every resource capability"
depends_on: "Ω-001, Ω-015, Ω-017"
source_mirror: "docs/current-docs/notion/work-packets/omega-020-freeze-the-cross-resource-template-parameter-and-materialization-contract.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-020 — Freeze the cross-resource Template parameter and materialization contract

## Mission

Taurus has one versioned, resource-neutral contract for capturing a reusable template, declaring its parameters/context slots, previewing it, and materializing a copy as either a new Resource or content inserted into an existing compatible Resource. The contract supports: - a whole Document or a selected Document section; - a whole Spreadsheet or one sheet inserted as a new sheet; - a whole Slides deck or one slide; - a Chat prompt/turn pattern; - stable parameters that can bind literal values, Context, Resources, or Files. Templates are copies, not live links. Editing a library template does not mutate past materializations or its source Project. Lineage remains inspectable.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-001, Ω-015, Ω-017**.

Source dependency statement: Ω-001, Ω-015, Ω-017.

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
- `docs/current-docs/notion/work-packets/omega-020-freeze-the-cross-resource-template-parameter-and-materialization-contract.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/document` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/resource` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/document` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/wiring/resource_generator.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-020-freeze-the-cross-resource-template-parameter-and-materialization-contract.md`

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


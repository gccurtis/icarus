---
title: "Execute Ω-028 — Introduce the typed multi-lattice ingestion router"
packet_id: "Ω-028"
status: "ready-for-execution"
wave: "Wave 3 — Complete ingestion, retrieval, and connectors"
depends_on: "Ω-002, Ω-003, Ω-004, Ω-005, Ω-009, Ω-014, Ω-015, Ω-016, Ω-017, Ω-023, Ω-024, Ω-025, Ω-026"
source_mirror: "docs/current-docs/notion/work-packets/omega-028-introduce-the-typed-multi-lattice-ingestion-router.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-028 — Introduce the typed multi-lattice ingestion router

## Mission

Omega classifies an authorized immutable source version and routes it to exactly one primary projection family: - Text → Knowledge/Text lattice; - structured data → Structured Data descriptor lattice; - still image → Media descriptor lattice. The three lattices share pure geometric machinery where useful but have different capabilities, entries, tables, corpus generations, vector identities, retrieval APIs, and payload hydration. An image may additionally emit a separate OCR Text projection; that is not the same record appearing in two lattices. Every model-assisted projection is a durable, budgeted job with a receipt. Unsupported and ambiguous formats are typed user-visible outcomes, not silent skips.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-002, Ω-003, Ω-004, Ω-005, Ω-009, Ω-014, Ω-015, Ω-016, Ω-017, Ω-023, Ω-024, Ω-025, Ω-026**.

Source dependency statement: Ω-002–Ω-005, Ω-009, Ω-014–Ω-017, Ω-023–Ω-026.

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
- `docs/current-docs/notion/work-packets/omega-028-introduce-the-typed-multi-lattice-ingestion-router.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/knowledge` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/handlers/knowledge` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/wiring/connector_lattice.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-028-introduce-the-typed-multi-lattice-ingestion-router.md`

<callout icon="🧱" color="orange_bg">
	**Frozen-baseline addendum.** Router receipts/generations are the atomic visibility boundary. Stage candidate projections, enforce Ω-003 actual bytes and actual windows+nodes counts, validate every accepted artifact, then flip the visible source/generation once. If source-by-source commits are intentionally retained, the run and connector remain visibly `partial` until all planned sources reconcile. Never let a capacity/provider failure look like a complete sync.
</callout>
**Type:** Supporting  
**Wave:** 3 — Complete ingestion, retrieval, and connectors  
**Gate:** Project Backend Complete  
**Depends on:** Ω-002–Ω-005, Ω-009, Ω-014–Ω-017, Ω-023–Ω-026  
**Unblocks:** Ω-029, Ω-030, Ω-031, Ω-032
## Outcome
Omega classifies an authorized immutable source version and routes it to exactly
one primary projection family:
- Text → Knowledge/Text lattice;
- structured data → Structured Data descriptor lattice;
- still image → Media descriptor lattice.
The three lattices share pure geometric machinery where useful but have
different capabilities, entries, tables, corpus generations, vector identities,
retrieval APIs, and payload hydration. An image may additionally emit a separate
OCR Text projection; that is not the same record appearing in two lattices.
Every model-assisted projection is a durable, budgeted job with a receipt.
Unsupported and ambiguous formats are typed user-visible outcomes, not silent
skips.
## Current evidence
- Knowledge currently owns a text-shaped lattice whose source types are
	Document, Connector, and Chat attachment.
- Document ingestion is reachable only through project-scoped `/dev/knowledge`
	endpoints; resource changes do not automatically route through ingestion.
- Connector wiring converts every file to `knowledge.AddItem{Text: ...}`.
- No classifier, projector registry, Structured Data capability, Media
	capability, shared lattice package, ingestion receipt, or cross-projection
	provenance exists.
- Ω-005 leaves one indexed ascent inside Knowledge; this packet extracts only
	content-agnostic mechanics after behavior is proven.
## Before and after
```plain text
Before
Connector/handler → Knowledge.AddBatch(text)

After
core/platform/lattice/              pure geometric engine
core/application/ingestion/         classifier/coordinator/receipts
core/capability/knowledge/          Text projection + independent tables
core/capability/structureddata/     independent descriptor/artifact boundary
core/capability/media/              independent descriptor/artifact boundary
core/wiring/ingestion_*.go          ports and projector registry
core/handlers/ingestion/
```
## Scope
- Extract a content-agnostic lattice engine without changing Text behavior.
- Define source snapshot, classification, projector, admission, receipt, and
	error contracts.
- Add deterministic native translators for Document, selected Chat branch, and
	Slides visible text/notes.
- Route plain text and Markdown Files/connectors.
- Add durable ingestion jobs, receipts, lifecycle replacement/removal, and
	transport.
- Provide extension points consumed by Ω-029 and Ω-030.
## Non-goals
- Structured parsing/descriptors are Ω-029; images/OCR are Ω-030.
- Cross-lattice search and Agent tools are Ω-031.
- Connector lifecycle/provider adapters are Ω-032–Ω-033.
- DOCX/PPTX/PDF extraction is not invented here; unsupported formats return a
	typed result until their conversion/extractor packet lands.
- No audio/video or legacy XLS.
## Governing invariants
1. Classification begins only after caller authorization and immutable version
	resolution.
2. One source version has exactly one primary class.
3. Native Resource kind outranks MIME; trusted signature/MIME outranks extension.
4. A user-selected class chooses a parser family but never bypasses byte
	validation.
5. No vector comparison, node, entry, index row, or generation crosses a lattice
	boundary.
6. Generated descriptors are discovery metadata, never literal evidence.
7. Projection replacement is idempotent by source version + policy version.
8. Superseding/deleting a source retracts every projection derived from that
	exact source through registered ports.
9. Model calls occur only in durable jobs with retries, limits, cost telemetry,
	and a receipt.
10. Project/user scope is supplied by trusted execution context, not projector
	output or Agent input.
## Shared vocabulary
```go
type LatticeKind string
const (
    LatticeText       LatticeKind = "text"
    LatticeStructured LatticeKind = "structured_data"
    LatticeMedia      LatticeKind = "media"
)

type SourceVersionRef struct {
    ProjectID  string
    SourceKind string // resource | file | connector_item
    SourceID   string
    VersionID  string
    Revision   int64
    SHA256     string
    Label      string
}

type AuthorizedSnapshot interface {
    Ref() SourceVersionRef
    MIMEType() string
    Extension() string
    SizeBytes() int64
    Open(context.Context) (io.ReadCloser, error)
}

type Classification struct {
    Class      LatticeKind
    Format     string
    Confidence string // exact | declared | user_selected
}

type Projector interface {
    Class() LatticeKind
    Format() string
    Project(context.Context, AuthorizedSnapshot, ProjectionPolicy) (ProjectionResult, error)
}
```
Pure engine:
```go
type Entry struct {
    ID           string
    ProjectID    string
    LocalScopeID string
    Vector       []float32
    PayloadRef   string
}

type Engine interface {
    BuildLocal(entries []Entry) (LocalBuild, error)
    BuildOrRepairCorpus(ctx context.Context, store Store, scope Scope) (CorpusBuild, error)
    Retrieve(ctx context.Context, store Store, query Query) (Result, error)
}
```
The engine has no Source, Document, table, image, File, transport, provider, or
database knowledge. Each capability supplies its own store adapter and
`PayloadRef` semantics.
## Native Text translators
```plain text
Document
  canonical authored text in document order
  exclude prompt instructions/transient output unless canonicalized

Chat
  selected persisted branch in stable Turn order
  exclude hidden prompts, reasoning, credentials, tool payloads, drafts

Slides
  stable slide order, section, slide ID/position, visible text, table/chart
  labels and values, speaker notes
  exclude image description; images route independently to Media
```
Locators use stable Resource/object IDs, never names or positions alone.
## Persistence
```sql
CREATE TABLE ingestion_receipts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_version TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  class TEXT,
  format TEXT,
  policy_version TEXT NOT NULL,
  state TEXT NOT NULL,
  job_id TEXT,
  result_refs_json TEXT NOT NULL DEFAULT '[]',
  diagnostics_json TEXT NOT NULL DEFAULT '[]',
  usage_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, idempotency_key)
);

CREATE INDEX idx_ingestion_source
  ON ingestion_receipts(project_id, source_kind, source_id, source_version);
```
States: `accepted`, `classifying`, `projecting`, `publishing`, `complete`,
`partial`, `unsupported`, `ambiguous`, `failed`, `cancelled`, `superseded`.
## HTTP surface
```javascript
POST /ingestions
GET  /ingestions/:receiptID
POST /ingestions/:receiptID/classification
POST /ingestions/:receiptID/retry
POST /ingestions/:receiptID/cancel
GET  /ingestions?sourceKind=&sourceID=&cursor=&limit=
```
Typed codes include `unsupported_format`, `ambiguous_format`,
`format_mismatch`, `source_changed`, `source_inaccessible`,
`project_artifact_limit`, and `projector_unavailable`.
## Ordered implementation tasks
1. Freeze source/classification/projection/receipt schemas and supported-format
	matrix.
2. Extract the geometric engine behind a Knowledge adapter; run all current
	Knowledge tests without semantic output changes.
3. Add independent store/admission interfaces for Text, Structured, and Media.
4. Implement classifier using native kind, signature/MIME, extension, and
	validated user selection.
5. Implement Document/Chat/Slides/plain-text/Markdown Text translators.
6. Implement coordinator, durable jobs, receipts, idempotency, cancellation,
	replacement, and removal.
7. Replace `/dev/knowledge` ingestion with internal lifecycle publication and a
	supported receipt API; retain dev tooling only for diagnostics.
8. Add operation modes, access checks, pagination/redaction, telemetry, and live
	status events.
9. Run parity, recovery, load, and backend E2E; update all companions.
## Security, concurrency, jobs, and observability
- Verify signature, archive structure, MIME, size, and source version before
	parser selection.
- Source readers are server-authorized; projector output cannot introduce a new
	URL/path/File ID.
- Enforce one active projection job per source/policy target, with idempotent
	coalescing and supersession.
- Publish a projection generation atomically only after validation.
- Receipts/logs redact source content and provider prompts while preserving code,
	stage, dimensions/counts, duration, and usage.
- Emit classification outcomes, queue/lease lag, projection counts, bytes,
	artifacts/windows, provider calls/tokens/cost, replacements, removals, and
	partial/failure codes by lattice.
## Verification
- Knowledge engine extraction produces byte/ID/ranking parity.
- Classifier matrix covers valid, spoofed, conflicting, ambiguous, and unknown
	sources.
- User override cannot force invalid bytes through a parser.
- Resource translators have golden stable locators and exclusion tests.
- Crash/retry/supersede/delete at every job stage leaves one valid generation.
- Negative authorization for source, receipt, result, and retraction.
- Load/backpressure and Project capacity limits.
- Backend E2E: revise Document/Chat/Slides, observe automatic Text replacement,
	query exact current text, delete and verify retraction.
## Migration and rollback
Keep existing `knowledge_*` tables as Text tables. Extract code through adapters
before enabling new routing. Existing manually indexed sources receive synthetic
receipts only when provenance is complete; otherwise re-ingest them. Rollback
disables the coordinator and retains Text data. New Structured/Media placeholders
remain isolated and unread until their packets complete.
## Completion evidence
- All current Knowledge suites and retrieval outputs remain green.
- Supported-format/classifier and lifecycle matrices are published.
- Automatic native-resource Text ingestion and retraction E2E pass.
- Receipt recovery and zero-cross-lattice-table assertions pass.
- FOSS license gate is green.
## Sources
- Taurus Yesod Design — Multi-lattice ingestion
- Taurus Yesod Implementation — Multi-lattice migration
- `core/capability/knowledge`
- `core/handlers/knowledge`
- `core/wiring/connector_lattice.go`
- Ω-002–Ω-005
---


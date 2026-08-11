---
title: "Execute Ω-029 — Implement structured-data descriptors for CSV and XLSX"
packet_id: "Ω-029"
status: "ready-for-execution"
wave: "Wave 3 — Complete ingestion, retrieval, and connectors"
depends_on: "Ω-004, Ω-014, Ω-021, Ω-022, Ω-028"
source_mirror: "docs/current-docs/notion/work-packets/omega-029-implement-structured-data-descriptors-for-csv-and-xlsx.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-029 — Implement structured-data descriptors for CSV and XLSX

## Mission

Structured Data becomes an independent Project capability and lattice. It ingests CSV and modern XLSX source versions, retains exact bounded table/model artifacts, generates validated descriptions/tags for discovery, and retrieves an artifact handle before returning exact rows/cells. It does not flatten an entire workbook into ungrounded prose.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-004, Ω-014, Ω-021, Ω-022, Ω-028**.

Source dependency statement: Ω-004, Ω-014, Ω-021–Ω-022, Ω-028.

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
- `docs/current-docs/notion/work-packets/omega-029-implement-structured-data-descriptors-for-csv-and-xlsx.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-029-implement-structured-data-descriptors-for-csv-and-xlsx.md`

**Type:** Supporting  
**Wave:** 3 — Complete ingestion, retrieval, and connectors  
**Gate:** Project Backend Complete  
**Depends on:** Ω-004, Ω-014, Ω-021–Ω-022, Ω-028  
**Unblocks:** Ω-031, Ω-032, Ω-036
## Outcome
Structured Data becomes an independent Project capability and lattice. It
ingests CSV and modern XLSX source versions, retains exact bounded table/model
artifacts, generates validated descriptions/tags for discovery, and retrieves an
artifact handle before returning exact rows/cells. It does not flatten an entire
workbook into ungrounded prose.
## Current evidence
No Structured Data capability or table family exists. Connector files are
currently treated as UTF-8 text. Formula names/tables are not a substitute for
ingesting an arbitrary external dataset or workbook model.
## Before and after
```plain text
core/capability/structureddata/
  model.go descriptor.go ingestion.go service.go store.go tools.go
  projector_csv.go projector_xlsx.go lattice_adapter.go errors.go
core/integration/structureddata/xlsx/
core/platform/storage/sqlite/sqlite_structured_data.go
core/handlers/structureddata/
```
## Scope
- CSV dialect/encoding/header/schema profiling and exact artifact.
- XLSX safe package parsing, workbook/worksheet map, deterministic candidate
	regions, reasoning-assisted table/model-region descriptions.
- Descriptor validation, user verification/edits, tags, provenance.
- Independent Structured lattice and bounded artifact reads.
- Native Taurus Spreadsheet source projection.
- Durable jobs, receipts, API, Agent-read ports, telemetry.
## Non-goals
- No legacy XLS, macros, XLSM/XLAM/XLTM, ODS, database dumps, or external links.
- No execution of uploaded formulas or mutation of the source.
- No chart extraction or guaranteed Excel calculation parity.
- No “best effort” invented rows/columns.
- XLSX import into an editable Spreadsheet is Ω-036 and remains a separate flow.
## Governing invariants
1. The descriptor finds the artifact; exact artifact values ground claims.
2. Original lexemes, null versus empty, leading zeros, exact decimals, formula
	source, cached value, and source coordinates remain distinguishable.
3. Inference cannot invent a column, sheet, range, formula, or relationship that
	the validator cannot map to source evidence.
4. User-verified descriptor fields outrank inferred fields.
5. Refresh preserves verified metadata only while evidence selectors still
	resolve; otherwise it becomes stale for review.
6. Artifacts and lattice generations are Project/source-version scoped.
7. Large artifacts are chunked and read through bounded selectors.
8. Uploaded formulas/macros are data, never executable code.
## Core model
```go
type StructuredSource struct {
    ID, ProjectID string
    Source        SourceVersionRef
    Format        string // csv | xlsx | taurus_spreadsheet
    PolicyVersion string
    Parser        ParserIdentity
    Generation    int64
    Status        string
}

type StructuredArtifact struct {
    ID, ProjectID, SourceID string
    Kind        string // table | model_region | worksheet | workbook
    ParentID    string
    Locator     StructuredLocator
    Shape       TableShape
    ContentHash string
    Descriptor  StructuredDescriptor
}

type StructuredLocator struct {
    Kind       string // csv_rows | xlsx_range | spreadsheet_range | workbook
    SheetName  string
    SheetIndex int
    A1Range    string // provenance/display only
    StableRows []string
    StableCols []string
    RowStart, RowEnd int64
    ByteStart, ByteEnd int64
}
```
Descriptor:
```go
type StructuredDescriptor struct {
    Name, Summary, Purpose, Grain string
    Entities      []string
    Columns       []ColumnDescriptor
    Tags          []StructuredTag
    Relationships []RelationshipCandidate
    Roles         []RoleCandidate // input | driver | calculation | output
    Confidence    float32
    Status        string // machine | verified | user | stale
    Evidence      []StructuredEvidenceRef
    Provenance    DescriptorProvenance
}
```
## Deterministic extraction and inference
CSV normally yields one table. Parse with Go `encoding/csv`, bounded dialect
sampling, explicit encoding policy, row-width diagnostics, original lexemes, and
typed candidate values.
For XLSX:
1. validate ZIP/OOXML relationships and decompression limits;
2. inventory sheets, used ranges, defined names, Excel tables, formulas, merges,
	hidden rows/columns, and style/density changes;
3. deterministically propose rectangular tables and spatial model regions using
	blank boundaries, type/formula density, named ranges/tables, and labels;
4. send a bounded Workbook Map plus representative Table/Region Cards to the
	configured reasoning cast;
5. validate returned selectors/names/roles against the inventory;
6. persist exact artifact chunks and descriptors;
7. embed descriptor text only.
If inference is unavailable, persist machine-described artifacts with
`descriptor_pending`; do not discard exact data.
Recommended parser: `github.com/qax-os/excelize/v2`, BSD-3-Clause, pinned after a
license, CVE, ZIP-limit, and streaming-API review. CSV uses the standard library.
## Persistence
```sql
CREATE TABLE structured_sources (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
  source_ref_json TEXT NOT NULL, format TEXT NOT NULL,
  policy_version TEXT NOT NULL, parser_json TEXT NOT NULL,
  generation INTEGER NOT NULL, status TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE structured_artifacts (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_id TEXT NOT NULL,
  parent_id TEXT, kind TEXT NOT NULL, locator_json TEXT NOT NULL,
  shape_json TEXT NOT NULL, content_hash TEXT NOT NULL,
  descriptor_json TEXT NOT NULL, descriptor_status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE structured_artifact_chunks (
  project_id TEXT NOT NULL, artifact_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL, rows_start INTEGER NOT NULL,
  rows_end INTEGER NOT NULL, payload BLOB NOT NULL,
  payload_hash TEXT NOT NULL,
  PRIMARY KEY(project_id, artifact_id, ordinal)
);
```
Add an entirely separate `structured_lattice_*` state/window-entry/node/index/
edge family through the shared lattice store interface. Do not reuse
`knowledge_*`.
## HTTP surface
```javascript
GET  /structured-data/sources/:sourceID
GET  /structured-data/artifacts?sourceID=&cursor=&limit=
GET  /structured-data/artifacts/:artifactID
GET  /structured-data/artifacts/:artifactID/rows?start=&limit=&columns=
PATCH /structured-data/artifacts/:artifactID/descriptor
POST /structured-data/search
```
Search returns descriptor matches and handles. Exact row/cell reads are separate
and bounded.
## Ordered implementation tasks
1. Freeze schemas, limits, descriptor prompt/output schema, and golden fixture
	corpus.
2. Add capability/store and separate lattice adapter/tables.
3. Implement exact CSV parser/profiler/chunk writer.
4. License-review and integrate Excelize; implement safe workbook inventory and
	exact cell/formula extraction.
5. Implement deterministic region candidates and bounded cards.
6. Add configured reasoning/embedding casts, descriptor validator, user
	verification, and fallback status.
7. Add Taurus Spreadsheet projector using stable IDs.
8. Add jobs/receipts, replacement/retraction, API, access, pagination,
	observability, and Agent read ports.
9. Add adversarial, recovery, load, live, and companion documentation.
## Security, concurrency, jobs, and observability
- Reject encrypted, macro-enabled, external-link, path-traversal, recursive,
	decompression-bomb, excessive-sheet/row/column/style/formula, and malformed
	packages with typed diagnostics.
- Never evaluate formulas or follow external relationships.
- Reasoning cards follow sensitive-sample policy; schema-only mode can suppress
	raw cell samples.
- Descriptor edits use revision/CAS; source refresh publishes a new generation
	atomically.
- Jobs are Project/source scoped, idempotent, cost-bounded, retry-bounded, and
	supersedable.
- Emit bytes, sheets, candidate/artifact counts, rows/cells, parse warnings,
	descriptor/model usage/cost, validation rejects, chunk-read latency, and
	generation state.
## Verification
- CSV dialect/header/encoding/quote/ragged/null/exact-lexeme fixtures.
- XLSX formulas/cached values/names/tables/merged/hidden/sparse/large/adversarial
	fixtures.
- Descriptor hallucinations and invalid selectors are rejected.
- Artifact chunk reassembly exactly matches parsed source values.
- Replacement/retraction, crash/retry, access revocation, and user descriptor
	preservation/staleness.
- Load: large CSV and workbook under memory/read limits.
- Backend E2E: ingest, search descriptor, read exact rows, cite source locator,
	revise, re-ingest, verify old generation is not current.
## Migration and rollback
All tables are new. Register the Structured projector only after parser and
store suites pass. Derived artifacts/lattice rows may be rebuilt from canonical
sources; user-verified descriptor edits require backup/migration preservation.
Rollback unregisters routing and leaves rows isolated.
## Completion evidence
- Parser/descriptor/store/lattice/security/load/live matrices pass.
- A report demonstrates descriptor discovery followed by exact artifact read.
- Excelize version, BSD-3-Clause license, SBOM, and vulnerability review are
	attached.
- No legacy XLS or macro execution path exists.
## Sources
- Taurus Yesod Model — Structured Data capability
- Taurus Yesod Design/Implementation — Multi-lattice ingestion
- Taurus Yesod Import — XLSX to Spreadsheet
- [Excelize source and BSD-style license notice](https://github.com/qax-os/excelize)
- Ω-028 typed router
---


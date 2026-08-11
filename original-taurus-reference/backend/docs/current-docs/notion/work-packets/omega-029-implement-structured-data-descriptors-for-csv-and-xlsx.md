---
title: "Work Packet — Ω-029 — Implement structured-data descriptors for CSV and XLSX"
notion_page_id: "3adb6410e50281cc8a40c4fc26f361d9"
notion_url: "https://app.notion.com/3adb6410e50281cc8a40c4fc26f361d9"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 00:08:50Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-029 — Implement structured-data descriptors for CSV and XLSX

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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


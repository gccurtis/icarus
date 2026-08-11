---
title: "Execute Ω-035 — Implement Document DOCX import/export and PDF export"
packet_id: "Ω-035"
status: "ready-for-execution"
wave: "Wave 4 — Complete conversion"
depends_on: "Ω-017, Ω-034"
source_mirror: "docs/current-docs/notion/work-packets/omega-035-implement-document-docx-import-export-and-pdf-export.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-035 — Implement Document DOCX import/export and PDF export

## Mission

An authorized caller can import a hostile-but-supported DOCX into one new canonical Taurus Document, export an exact Document revision as an editable DOCX, and export that revision as a page-faithful PDF. Every operation uses the Ω-034 substrate, publishes durable diagnostics and provenance, and is usable from the backend without Alpha.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-017, Ω-034**.

Source dependency statement: Ω-017, Ω-034, the File/Object port, and production adapters in
Ω-042

Later integration or re-certification references in that source section: **Ω-042**. These are not start blockers; implement the packet against its declared ports and leave the production adapter or downstream certification to those later packets.

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
- `docs/current-docs/notion/work-packets/omega-035-implement-document-docx-import-export-and-pdf-export.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `docs/current-docs/notion/primary/architecture-taurus-layered-application-model--3acb6410e502.md`
- `docs/current-docs/notion/primary/deployment-taurus-topology-and-scaling-model--3acb6410e502.md`
- `docs/current-docs/notion/primary/export-document-to-docx--3acb6410e502.md`
- `docs/current-docs/notion/primary/export-document-to-pdf--3acb6410e502.md`
- `docs/current-docs/notion/primary/import-docx-to-document--3acb6410e502.md`
- `docs/current-docs/notion/primary/model-workspace-capability-and-runtime-contract--3acb6410e502.md`

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

Source mirror: `docs/current-docs/notion/work-packets/omega-035-implement-document-docx-import-export-and-pdf-export.md`

### Outcome
An authorized caller can import a hostile-but-supported DOCX into one new
canonical Taurus Document, export an exact Document revision as an editable
DOCX, and export that revision as a page-faithful PDF. Every operation uses the
Ω-034 substrate, publishes durable diagnostics and provenance, and is usable
from the backend without Alpha.
### Reviewed evidence and library decision
[Import - DOCX to Document](https://app.notion.com/p/3acb6410e50281038192e08fc89b605a),
[Export - Document to DOCX](https://app.notion.com/p/3acb6410e5028134aedfe63676d5418c),
and [Export - Document to PDF](https://app.notion.com/p/3acb6410e502817fbde1f33e76f61b82)
are the semantic authorities.
- Import: Mammoth 1.12.0 (BSD-2-Clause) plus parse5 (MIT) in the isolated
	TypeScript worker.
- DOCX export: docx.js 9.7.1 (MIT) in the isolated TypeScript worker.
- PDF export: WeasyPrint 69.0 (BSD-3-Clause) in the isolated Python worker,
	followed by qpdf 12.3.x structural validation and Taurus policy inspection.
Versions are exact pins from the reviewed design and must be rechecked for
security and license status at implementation. Upgrade only through the fixture
corpus and an explicit mapping-version change. No commercial fallback is part
of this packet.
### Scope and non-goals
DOCX import is semantic and best effort. It preserves supported headings,
paragraphs, runs/marks, lists, tables, links, images, explicit breaks, and safe
notes or fields where the Document model has an honest representation. It
creates a new Document; it does not merge into an existing one. Review state,
tracked changes, macros, active content, arbitrary fields, external
relationships, unsupported floating layout, and unsupported graphics are
dropped or materialized with bounded diagnostics.
DOCX export preserves semantic editability, styles, page geometry, paragraph
constraints, assets, and explicit author page breaks. It does not freeze
incidental pagination, emit `w:lastRenderedPageBreak`, guarantee Office/Taurus
round-trip identity, or turn pages into pictures.
PDF export preserves Taurus canonical page membership and line wrapping. The
Document capability, not WeasyPrint, decides pages. V1 emits an unencrypted
static PDF with embedded/subset fonts, vector content where supported, links,
and an outline. There is no editable PDF import, signing, encryption,
attachments, forms, JavaScript, or PDF/A/PDF/UA compliance claim.
### Invariants and capability boundary
- Import source is an authorized immutable File with verified DOCX content,
	not merely a `.docx` extension.
- The worker emits a parser-neutral draft and staged assets. Omega assigns
	Document/row/track/block/atom IDs and commits one complete Base.
- An import warning never silently broadens the canonical model. Unsupported
	behavior is dropped or safely materialized and named in the receipt.
- Export snapshots contain no hidden reasoning, secrets, deleted content, or
	resource state the caller cannot read.
- DOCX and PDF export pin an exact revision and never evaluate prompt blocks.
	Formula blocks use accepted display output or an explicit diagnostic.
- PDF painting consumes positioned, resolved rows/lines/runs. Worker-side
	reflow that changes canonical page membership is a hard validation failure.
### Target paths, API, and interfaces
```plain text
core/capability/document/interchange/
  import.go             draft validation and atomic base creation
  docx_snapshot.go      semantic editable snapshot
  pdf_snapshot.go       canonical paint snapshot
core/integration/office/docx/
  import/ export/       Ω-034 adapters
core/integration/pdf/document/
workers/office-ts/docx-import/
workers/office-ts/docx-export/
workers/office-py/pdf/
tests/fixtures/office/docx-import/
tests/fixtures/office/docx-export/
tests/fixtures/pdf/document/
```
```go
type DocumentImporter interface {
    Plan(ctx context.Context, source FileRef, options ImportOptions) (ImportPlan, error)
    Commit(ctx context.Context, actor Actor, plan ValidatedDocumentDraft) (Document, error)
}

type DocumentSnapshotReader interface {
    ResolveDOCX(ctx context.Context, actor Actor, id string, revision uint64) (DOCXSnapshotV1, error)
    ResolvePDF(ctx context.Context, actor Actor, id string, revision uint64) (DocumentPDFSnapshotV1, error)
}
```
Representative explicit-Project routes:
```plain text
POST /projects/{projectID}/document-imports
GET  /projects/{projectID}/document-imports/{receiptID}
POST /projects/{projectID}/documents/{documentID}/exports
GET  /projects/{projectID}/exports/{receiptID}
GET  /projects/{projectID}/exports/{receiptID}/artifact
```
The request names `sourceFileID` or `documentID`, exact revision for export,
format, bounded options, and `clientRequestId`. Artifact delivery uses an
authorized Omega endpoint or short-lived scoped capability, not a public object
URL.
### Mapping requirements
DOCX import traverses safe semantic HTML from Mammoth through parse5. It maps
styles using a Taurus-owned allowlist rather than accepting source CSS/HTML.
Hyperlinks accept safe schemes only. Images are staged and ingested through the
File capability. Tables are rectangularized only where the model can represent
them; unsupported nesting/merges produce explicit diagnostics. Fields are
materialized as safe display text when possible. Page geometry and arbitrary
floating layout are not reconstructed.
DOCX export resolves a style registry once, maps rows/tracks/blocks/atoms to
sections, paragraphs, runs, lists, tables, images, links, notes, fields, and
math supported by docx.js, and emits only intentional page breaks. Missing
fonts/assets or last-good formula output are diagnostics according to strict
versus balanced policy.
`DocumentPDFSnapshotV1` contains page layout, ordered pages, header/body/footer
rows, positioned tracks/blocks, resolved text lines/runs, images/callouts,
styles, assets, links, and outline entries. The Python worker generates only
Taurus-owned escaped HTML/CSS. User HTML, CSS, URLs, templates, and paths never
reach WeasyPrint.
### Sequential tasks
1. Freeze import draft, DOCX snapshot, PDF snapshot, mapping policy,
	diagnostics, and limits.
2. Register DOCX/PDF format handlers with Ω-034 and add exact-revision
	authorization/read ports.
3. Implement DOCX package preflight and the Mammoth/parse5 worker.
4. Validate/map the draft and commit one Document Base, Activity entry,
	provenance record, and receipt atomically.
5. Implement semantic DOCX snapshot resolution and docx.js emission.
6. Implement canonical PDF snapshot resolution, WeasyPrint painting, qpdf
	validation, and Taurus forbidden-object policy.
7. Add request/status/download handlers and retention/reaping policy.
8. Build the canonical, intentionally lossy, producer, scale, and hostile
	corpus and publish the fidelity matrix.
### Security, concurrency, idempotency, and observability
All Ω-034 controls apply. Import authorizes File read plus Document create.
Export authorizes Document read and `project.export.request`; delivery
reauthorizes. ZIP preflight rejects encryption, macros/active content, external
relationships, traversal, duplicate parts, and resource-limit overflow.
Generated HTML is escaped and declarative.
Import idempotency includes Project, caller, source File ID/hash, parser and
contract versions, mapping version, options, and client key. A duplicate returns
the same Document/receipt. Export idempotency includes exact revision and
profile. Concurrent source edits are irrelevant because the revision is pinned.
Atomic import commit includes Resource registration, Document Base, provenance,
Activity, and receipt. Artifact publication becomes visible only after
validation.
Metrics add paragraphs, runs, tables, images, pages, explicit breaks, dropped
feature counts, canonical-overflow events, font fallbacks, render/validation
time, and output bytes. Logs contain no document text or source filenames.
### Tests and failure drills
- Golden semantic imports from current Word, LibreOffice, Google Docs, and
	Pages-exported DOCX.
- Loss tests prove known unsupported constructs are diagnosed and do not leak
	active/external content.
- DOCX export opens in Word-compatible and LibreOffice QA, remains editable,
	preserves explicit breaks, and contains no historical rendered-page breaks.
- PDF raster fixtures prove exact Taurus page count, order, dimensions, line
	membership, links, outline, fonts, images, headers, and footers.
- Hostile ZIP/XML/HTML/URL/image/font cases fail closed.
- Concurrent duplicate imports, worker crash before sentinel, commit-ack crash,
	export retry after head advance, revocation during render, object failure,
	timeout, and restart all preserve exactly-once visibility.
- qpdf failure, forbidden PDF action, missing asset, font fallback in strict
	mode, and canonical overflow are exercised as release-blocking failures.
### Migration, rollback, and completion evidence
Ship endpoints dark and leave Markdown export untouched. Enable internal
fixtures, then test Projects, then production. No historical Document is
rewritten or auto-exported. Rollback disables format registration and drains
jobs; completed Files and receipts remain readable during their retention
window. Additive schema is removed only after the rollback window.
Completion requires backend-only demonstrations of all three flows, exact
revision/replay evidence, the producer/fidelity report, hostile-fixture report,
license/SBOM proof, no-egress proof, and successful restore of an import receipt
and export artifact from production storage.
### Dependencies
Depends on Ω-017, Ω-034, the File/Object port, and production adapters in
Ω-042. Blocks the interchange portion of Ω-044.
### Linked sources
- [Model — Workspace Capability & Runtime Contract](https://app.notion.com/p/3acb6410e50281ddaa6dca8f6e1802fb)
- [Architecture — Taurus Layered Application Model](https://app.notion.com/p/3acb6410e502812bb4e0ff2c91ff753f)
- [Deployment — Taurus Topology & Scaling Model](https://app.notion.com/p/3acb6410e502816585d9e96ff02921d8)


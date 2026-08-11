---
title: "Work Packet — Ω-035 — Implement Document DOCX import/export and PDF export"
notion_page_id: "3acb6410e5028191b118e2013904db29"
notion_url: "https://app.notion.com/3acb6410e5028191b118e2013904db29"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:47:54Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-035 — Implement Document DOCX import/export and PDF export

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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


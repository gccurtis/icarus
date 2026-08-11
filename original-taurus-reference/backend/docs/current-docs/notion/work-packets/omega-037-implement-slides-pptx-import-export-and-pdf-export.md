---
title: "Work Packet — Ω-037 — Implement Slides PPTX import/export and PDF export"
notion_page_id: "3acb6410e502819cbe8ce2eab833514c"
notion_url: "https://app.notion.com/3acb6410e502819cbe8ce2eab833514c"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:47:54Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-037 — Implement Slides PPTX import/export and PDF export

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

### Outcome
Omega imports one supported PPTX as one new Taurus Deck, exports an exact Deck
revision as an editable static PPTX, and exports that revision as a fixed-page
PDF. Geometry, rank, stable unnamed slide identity, supported visual objects,
notes, links, templates, and static display state remain honest. Unsupported
PowerPoint behavior is dropped explicitly rather than approximated as a hidden
runtime.
### Reviewed evidence and library decision
The authorities are
[Import - PPTX to Slides](https://app.notion.com/p/3acb6410e5028108b8bdc90ce4eeec9c),
[Export - Slides to PPTX](https://app.notion.com/p/3acb6410e5028156bee8c6cca9f2ab87),
[Export - Slides to PDF](https://app.notion.com/p/3acb6410e50281419ce6ed5fd51edf09),
and [Model — Slides Capability & Runtime Contract](https://app.notion.com/p/3abb6410e50281df8762c162e9a6eb13).
- PPTX import: python-pptx 1.0.2 (MIT), with pinned lxml and Pillow, in an
	isolated Python worker.
- PPTX export: PptxGenJS 4.0.1 (MIT) in the isolated TypeScript worker.
- PDF export: WeasyPrint 69.0 plus qpdf 12.3.x in the shared Python worker.
All packages are pinned, hash-verified, SBOM-recorded, and replaceable. There is
no commercial fallback, PowerPoint process, hosted conversion, or animation
library.
### Scope and non-goals
Import preserves canvas geometry, stable slide order, supported z-ordered
shapes, text, pictures, tables, supported charts, shallow groups, notes, links,
and safe theme/style projections. `python-pptx` has no stable high-level section
API, so imported slides are unsectioned and `PPTX_SECTIONS_DROPPED` is reported.
Master/layout behavior is simplified to concrete supported appearance.
Export preserves canvas, sections, slide order, supported masters/layout
templates, visual objects, text, images, tables, supported charts, equations/
vectors, groups, notes, and links as ordinary editable PPTX structures where
the library supports them. PDF emits one exact-size page per included visible
slide and optional section outline entries.
Animations and transitions are permanently excluded. Also excluded are active
content, macros, arbitrary embeds, audio/video, unsupported SmartArt, review
state, external relationships, live chart/provider refresh, encrypted
presentations, editable PDF import, and any round-trip promise.
### Invariants
1. Deck hierarchy is `Deck → SlideSection → Slide → VisualObject`.
2. Slides have stable IDs and ranks but no user-visible names. Source titles are
	content, not slide identity; ordinal is a projection.
3. Geometry is validated integer EMU. NaN/Inf/overflow and off-limit object
	counts fail before commit.
4. Worker draft IDs and locators are temporary. Omega assigns canonical Deck,
	Section, Slide, Object, asset, and revision IDs.
5. Import publishes one complete Deck Base or nothing. A valid empty slide is
	valid; a deck with no valid slides is not.
6. The worker never executes animation, transition, macro, embed, chart query,
	equation process, prompt, or provider call.
7. Export consumes an exact revision and resolved static display state. Hidden
	slides are omitted from PDF by default under explicit options.
8. PDF page size and object coordinates come directly from the canonical paint
	snapshot; WeasyPrint is a painter, not a layout authority.
### Target paths, contracts, and routes
```plain text
core/capability/slides/interchange/
  import.go pptx_snapshot.go pdf_snapshot.go diagnostics.go
core/integration/office/pptx/import/
core/integration/office/pptx/export/
core/integration/pdf/slides/
workers/office-py/pptx-import/
workers/office-ts/pptx-export/
workers/office-py/pdf/
tests/fixtures/office/pptx-import/
tests/fixtures/office/pptx-export/
tests/fixtures/pdf/slides/
```
```go
type DeckImportDraft struct {
    Canvas      CanvasDraft
    Slides      []SlideDraft
    Assets      []DraftAsset
    Diagnostics []Diagnostic
}

type SlidesSnapshotReader interface {
    ResolvePPTX(ctx context.Context, actor Actor, deckID string, rev uint64) (PPTXSnapshotV1, error)
    ResolvePDF(ctx context.Context, actor Actor, deckID string, rev uint64) (SlidesPDFSnapshotV1, error)
}

type SlidesPDFSnapshotV1 struct {
    Canvas  PDFCanvas
    Slides  []PDFSlide
    Outline []PDFOutlineEntry
    Assets  []PDFAssetReference
}
```
```plain text
POST /projects/{projectID}/slides-imports
GET  /projects/{projectID}/slides-imports/{receiptID}
POST /projects/{projectID}/decks/{deckID}/exports
GET  /projects/{projectID}/exports/{receiptID}
GET  /projects/{projectID}/exports/{receiptID}/artifact
```
The import worker traverses `slide.shapes` back-to-front, preserving z-order.
Supported groups remain shallow groups; unsupported transform combinations are
flattened with composed frames and a diagnostic. Picture blobs are staged for
File ingestion. Notes are visible-author notes only. The package inspector
coalesces animation/transition diagnostics without executing private behavior.
PPTX export maps resolved theme/layout slots and override masks to supported
masters/layouts. It creates fresh package-local identities. Internal links map
by stable source slide ID to generated targets. Charts receive a static
resolved data snapshot. No worker reads Project resources.
The PDF snapshot contains canvas, ordered slide paint records, background,
z-ordered typed objects, bounds, transform, clip, resolved text lines/runs,
shapes/lines/images/tables/vector/group objects, link targets, outline, and
assets. Text overflow follows the model’s resolved policy; the worker may not
silently resize.
### Sequential tasks
1. Freeze PPTX draft, export snapshot, PDF paint snapshot, diagnostic taxonomy,
	limits, static-resolution rules, and mapping versions.
2. Implement package preflight and isolated python-pptx extraction.
3. Map canvas, order, geometry, text, shapes, groups, images, tables, supported
	charts, notes, links, and safe theme appearance; coalesce dropped behavior.
4. Validate and atomically commit one Deck Base, Resources/assets, provenance,
	Activity, and receipt.
5. Implement exact-revision PPTX snapshot and PptxGenJS emission plus structural
	and policy validation.
6. Implement exact-size PDF snapshot, WeasyPrint emission, qpdf/Taurus policy,
	and visual fixtures.
7. Add handlers, status/download, cancellation, retention, and cleanup.
8. Complete producer, loss, hostile, and scale corpora and publish fidelity.
### Security, concurrency, idempotency, and observability
Apply Ω-034. Reject encryption, macros/active content, traversal, duplicate
parts, DTD/entity behavior, external relationships, package expansion,
excessive slides/objects/text/media/XML depth, invalid EMUs, and unsupported
content types. Pin and scan python-pptx, lxml, Pillow, PptxGenJS, Node, Python,
WeasyPrint, and qpdf.
Import idempotency includes Project, caller, File/hash, parser/contract/mapping
versions, options, and client key. Export includes exact Deck revision, hidden
slide policy, notes policy, profile, and renderer versions. At-least-once
delivery yields one Deck/receipt or one artifact. Import commit is one
transaction for Deck Base, Resource registration, assets/lineage, Activity,
and receipt; staged objects are promoted only on commit.
Metrics include slides/objects/groups/text runs/images/tables/charts/notes,
dropped sections/animations/transitions/masters/SmartArt/embeds/media, text
overflow, geometry rejections, asset bytes, pages, render time, validation
time, output bytes, retries, and resource peaks. Slide text and notes never
enter logs.
### Tests and failure drills
- Stable unnamed slide identity and rank; no imported source filename/title
	becomes a slide name.
- Producer decks from PowerPoint, LibreOffice, Google Slides export, and Keynote
	export where available.
- EMU geometry, z-order, group transforms, text wrapping, font fallback, image
	crop, tables, supported charts, notes, links, sections-on-export, masters,
	hidden slides, and empty slides.
- Animated/transitioned decks prove permanent drop with coalesced diagnostics
	and no active behavior in output.
- Unsupported SmartArt/embed/audio/video/review/external relationships are
	dropped or rejected exactly as policy declares.
- PDF raster fixtures prove one page per included slide, exact canvas, order,
	clipping, object paint order, links, and outline.
- Hostile package, malformed XML, decompression, image, geometry, object-count,
	timeout/OOM, crash/truncation, duplicate request, revocation, object outage,
	commit-ack loss, and restart drills.
### Migration, rollback, and completion evidence
No existing Deck is rewritten. Add routes behind format gates. Imported decks
start without sections unless the Taurus user later creates them. Rollback
disables adapters and drains jobs; completed Decks/artifacts remain canonical.
Never introduce a temporary animation representation that would later need a
destructive migration.
Completion evidence includes backend-only PPTX import/export/PDF flows, exact
revision and idempotent replay proof, producer/fidelity/loss reports,
hostile-package and no-egress reports, license/SBOM records, bounded scale
profile, and a restore proving Deck, assets, provenance, receipt, and artifacts
survive production recovery.
### Dependencies
Depends on Ω-023, Ω-024, Ω-034, File/Object, and Ω-042. Blocks the Slides
interchange portion of Ω-044.
### Linked sources
- [Design — Multi-Lattice Ingestion Architecture](https://app.notion.com/p/3acb6410e50281bf8f16ec589da555d3)
- [Architecture — User Cell & Project Subcell Runtime](https://app.notion.com/p/3acb6410e5028147909ef7214406baad)
- [Deployment — Taurus Topology & Scaling Model](https://app.notion.com/p/3acb6410e502816585d9e96ff02921d8)


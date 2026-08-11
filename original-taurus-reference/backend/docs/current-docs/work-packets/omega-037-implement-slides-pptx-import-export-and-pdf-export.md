---
title: "Execute Ω-037 — Implement Slides PPTX import/export and PDF export"
packet_id: "Ω-037"
status: "ready-for-execution"
wave: "Wave 4 — Complete conversion"
depends_on: "Ω-023, Ω-024, Ω-034"
source_mirror: "docs/current-docs/notion/work-packets/omega-037-implement-slides-pptx-import-export-and-pdf-export.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-037 — Implement Slides PPTX import/export and PDF export

## Mission

Omega imports one supported PPTX as one new Taurus Deck, exports an exact Deck revision as an editable static PPTX, and exports that revision as a fixed-page PDF. Geometry, rank, stable unnamed slide identity, supported visual objects, notes, links, templates, and static display state remain honest. Unsupported PowerPoint behavior is dropped explicitly rather than approximated as a hidden runtime.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-023, Ω-024, Ω-034**.

Source dependency statement: Ω-023, Ω-024, Ω-034, File/Object, and Ω-042

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
- `docs/current-docs/notion/work-packets/omega-037-implement-slides-pptx-import-export-and-pdf-export.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `docs/current-docs/notion/primary/architecture-user-cell-and-project-subcell-runtime--3acb6410e502.md`
- `docs/current-docs/notion/primary/deployment-taurus-topology-and-scaling-model--3acb6410e502.md`
- `docs/current-docs/notion/primary/design-multi-lattice-ingestion-architecture--3acb6410e502.md`
- `docs/current-docs/notion/primary/export-slides-to-pdf--3acb6410e502.md`
- `docs/current-docs/notion/primary/export-slides-to-pptx--3acb6410e502.md`
- `docs/current-docs/notion/primary/import-pptx-to-slides--3acb6410e502.md`
- `docs/current-docs/notion/primary/model-slides-capability-and-runtime-contract--3abb6410e502.md`

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

Source mirror: `docs/current-docs/notion/work-packets/omega-037-implement-slides-pptx-import-export-and-pdf-export.md`

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


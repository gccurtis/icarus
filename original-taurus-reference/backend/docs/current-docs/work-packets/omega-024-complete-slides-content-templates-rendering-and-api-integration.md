---
title: "Execute Ω-024 — Complete Slides content, templates, rendering, and API integration"
packet_id: "Ω-024"
status: "ready-for-execution"
wave: "Wave 2 — Implement every resource capability"
depends_on: "Ω-014, Ω-020, Ω-023"
source_mirror: "docs/current-docs/notion/work-packets/omega-024-complete-slides-content-templates-rendering-and-api-integration.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-024 — Complete Slides content, templates, rendering, and API integration

## Mission

Slides has complete content semantics, deterministic safe preview rendering, deck and slide templates, File-backed media, Agent operations, live delivery, and every backend contract Alpha needs. Slides remain animation-free.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-014, Ω-020, Ω-023**.

Source dependency statement: Ω-014, Ω-020, Ω-023.

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
- `docs/current-docs/notion/work-packets/omega-024-complete-slides-content-templates-rendering-and-api-integration.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/file` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-024-complete-slides-content-templates-rendering-and-api-integration.md`

**Type:** Supporting  
**Wave:** 2 — Implement every resource capability  
**Gate:** Project Backend Complete  
**Depends on:** Ω-014, Ω-020, Ω-023  
**Unblocks:** Ω-027, Ω-028, Ω-031, Ω-037
## Outcome
Slides has complete content semantics, deterministic safe preview rendering,
deck and slide templates, File-backed media, Agent operations, live delivery,
and every backend contract Alpha needs. Slides remain animation-free.
## Scope
- Rich text, shapes, lines, groups, images, tables, and charts.
- Theme tokens, page background, object styles, accessibility metadata.
- Deterministic scene projection and sanitized SVG preview.
- Whole-deck and single-slide Template capture/materialization.
- Complete Resource, History, Activity, Agent, File, and live-event integration.
## Non-goals
- No animation/transitions, arbitrary HTML, scripts, external media URLs, video,
	audio, or embedded executable objects.
- No pixel-identical PowerPoint renderer.
- PPTX/PDF import/export remains Ω-037.
## Governing invariants
1. Canonical content is renderer-neutral typed data.
2. Rendering is deterministic for `(deck_revision, slide_id, render_profile)`.
3. Preview output contains no script, event handler, external URL, or unsafe SVG.
4. Text has explicit paragraphs/runs/marks and no hidden HTML authority.
5. Groups transform children without changing their stable IDs.
6. Tables are slide objects, not Spreadsheet aggregates.
7. Charts reference immutable inline data or an authorized stable Spreadsheet
	range snapshot; their provenance is explicit.
8. A slide Template has a Template name; the materialized Slide still has none.
9. File-backed images retain authorized immutable File references.
## Content and rendering contracts
```go
type TextContent struct {
    Paragraphs []Paragraph
}

type Paragraph struct {
    ID        string
    Runs      []TextRun
    Alignment string
    List      *ListStyle
}

type TextRun struct {
    ID    string
    Text  string
    Marks TextMarks
}

type Scene struct {
    Width   float64
    Height  float64
    Objects []SceneObject
    Fonts   []FontRef
}

type Renderer interface {
    Scene(deck Deck, slideID string, profile RenderProfile) (Scene, error)
    SVG(scene Scene) ([]byte, error)
}
```
Use IBM Plex as the Taurus shell/default UI family where applicable, while deck
content font choices remain explicit editor content. Font fallback must be
deterministic and license-approved.
The preview route returns generated safe SVG or a scene JSON contract:
```javascript
GET /slides/:deckID/slides/:slideID/scene
GET /slides/:deckID/slides/:slideID/preview.svg
```
Raster/PDF rendering belongs to the sandboxed conversion worker in Ω-034/Ω-037.
## Template behavior
- Capture whole deck → new Slides resource.
- Capture one Slide → insert into an existing deck or create a one-slide deck.
- IDs for slide, objects, paragraphs, runs, and internal references are remapped.
- `TemplateVersion.Name` is shown in the library; it is not copied as a slide
	name.
- A deck uploaded later through PPTX import may be saved as a deck Template.
## Ordered implementation tasks
1. Freeze each object-content schema and validation/limit policy.
2. Implement rich-text, grouping, table, chart, image, and accessibility
	operations.
3. Build pure Scene projection and golden tests.
4. Build an SVG serializer using standard/FOSS components only; sanitize and
	validate output.
5. Implement slide/deck Template-family adapter and ID remapping.
6. Add File authorization, thumbnail/preview caching by revision, and
	invalidation.
7. Complete routes, operation table, access guard, events, Resource, Activity,
	History, and Agent adapters.
8. Add Alpha-request fixtures, load/live suites, and companions.
## Security, concurrency, jobs, and observability
- Never execute imported/user SVG; decode supported images and render through
	Taurus primitives.
- Block external font/image URLs and XML entities.
- Bound decompression, dimensions, glyphs, object nesting, table area, output
	bytes, and render duration.
- Preview cache keys include Project/resource/revision/profile; access is
	rechecked before serving.
- Large preview renders may be coalesced durable jobs; scene reads stay inline.
- Emit render cache hit, duration, scene objects, output bytes, validation
	failures, template remaps, and stale-job rejection.
## Verification
- Golden Scene/SVG across every object kind and theme.
- Security corpus for SVG/script/URL/entity/font attacks.
- Text/layout properties, group transforms, z-order, chart/table/image
	rendering.
- Template ID/reference remapping and no Slide-name field.
- Concurrent edit/render never serves a mismatched revision.
- Load and bounded preview response.
- Backend E2E: author deck, preview, template a slide/deck, materialize, reload,
	undo/redo, receive events.
## Migration and rollback
Advance Slides snapshot schema additively. Preview/cache rows are derived and
discardable. Before an incompatible content-schema write, prove down-read or
take a backup. Rollback may disable new object kinds with a typed unsupported
response; it must not silently drop them.
## Completion evidence
- Object and renderer conformance matrices are green.
- Security/golden/live suites and Alpha request fixtures pass.
- Template workflows preserve names only at Template level.
- FOSS license inventory and font licenses are attached.
## Sources
- Taurus Yesod Model — Slides capability
- Slides Context/Inspector Panel pages
- Taurus Yesod Design — aesthetic/color/geometry/typography authorities
- `core/capability/file`
- Ω-020 Template contract
---


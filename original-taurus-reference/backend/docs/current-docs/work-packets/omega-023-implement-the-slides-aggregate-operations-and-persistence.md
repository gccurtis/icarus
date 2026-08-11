---
title: "Execute Ω-023 — Implement the Slides aggregate, operations, and persistence"
packet_id: "Ω-023"
status: "ready-for-execution"
wave: "Wave 2 — Implement every resource capability"
depends_on: "Ω-001, Ω-010, Ω-011, Ω-015, Ω-020"
source_mirror: "docs/current-docs/notion/work-packets/omega-023-implement-the-slides-aggregate-operations-and-persistence.md"
frozen_planning_baseline: "50efd18413cc47935033889e51d58e9c828733e2"
generated_at: "2026-07-30"
---

# Execute Ω-023 — Implement the Slides aggregate, operations, and persistence

## Mission

`slides` becomes a first-class Taurus Resource representing one ordered deck. Slides have stable IDs and positions, but no names and no rename operation. Named Sections organize contiguous groups of slides. Every visual object has a stable ID, geometry, z-order, and typed content. Base-revision ChangeSets, idempotency, persistence, history, and bounded projections match Omega's collaborative aggregate laws.

Own this packet from current-state verification through a verified commit pushed directly to `main`. This file is the single execution handoff: follow the directive below, then implement the full embedded specification.

## Dependency gate

Hard predecessors: **Ω-001, Ω-010, Ω-011, Ω-015, Ω-020**.

Source dependency statement: Ω-001, Ω-010, Ω-011, Ω-015, Ω-020.

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
- `docs/current-docs/notion/work-packets/omega-023-implement-the-slides-aggregate-operations-and-persistence.md` — exact Notion source mirror for this packet.
- `docs/architecture/runtime-model.md` and `docs/architecture/issues-and-gaps.md` — inspect their current versions, not only the frozen links embedded below.
- `core/capability/document` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/capability/resource` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.
- `core/transport/dispatch.go` — inspect the current path if it exists; treat a missing future path as work to design, not as evidence of failure.

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

Source mirror: `docs/current-docs/notion/work-packets/omega-023-implement-the-slides-aggregate-operations-and-persistence.md`

<callout icon="📖" color="blue_bg">
	**Exact-read family requirement.** Register Slides with Ω-015's readable-family contract. A deterministic `slides-outline/v1` projection identifies stable deck/slide/visual-object/text IDs and current revision; slides remain unnamed. Reads are version-pinned and bounded and do not depend on Media/Text lattice admission.
</callout>
**Type:** Supporting  
**Wave:** 2 — Implement every resource capability  
**Gate:** Project Backend Complete  
**Depends on:** Ω-001, Ω-010, Ω-011, Ω-015, Ω-020  
**Unblocks:** Ω-024, Ω-027, Ω-028, Ω-031, Ω-037
## Outcome
`slides` becomes a first-class Taurus Resource representing one ordered deck.
Slides have stable IDs and positions, but no names and no rename operation.
Named Sections organize contiguous groups of slides. Every visual object has a
stable ID, geometry, z-order, and typed content. Base-revision ChangeSets,
idempotency, persistence, history, and bounded projections match Omega's
collaborative aggregate laws.
## Current evidence
`resource.KindSlides` exists only as an enum. No Slides capability, tables,
routes, Resource adapter, rendering model, or history integration exists.
## Before and after
```plain text
Before
resource.KindSlides (enum only)

After
core/capability/slides/
  model.go operations.go apply.go validate.go
  service.go store.go history.go projection.go errors.go
core/handlers/slides/
core/platform/storage/sqlite/sqlite_slides.go
core/wiring/slides_*.go
dev-test/slides/
```
## Scope
- Deck, sections, slides, visual objects, theme/page geometry, speaker notes.
- Add/delete/duplicate/move slides; section grouping; object tree and z-order.
- Revision/CAS ChangeSets, inverse operations, history, undo/redo.
- Bounded descriptor, manifest, slide, and object projections.
- Resource and transport integration.
## Non-goals
- No animation, transitions, timeline, or playback model.
- Detailed rich text, templates, and rendering are Ω-024.
- PPTX/PDF interchange is Ω-037.
- No frontend canvas implementation.
## Governing invariants
1. Slides have stable IDs and never have canonical names.
2. Position is derived from the deck's ordered slide-ID list.
3. Sections have names and stable IDs; each slide belongs to at most one section.
4. Section membership/order remains valid after slide moves and deletions.
5. Visual object IDs are stable; z-order is an explicit stable sequence.
6. Child objects cannot form cycles and cannot escape their slide.
7. Geometry uses a deck-local coordinate system with finite bounded values.
8. One ChangeSet is atomic, revision checked, idempotent, and invertible where
	the History contract promises undo.
9. Hidden/deleted objects never leak through alternate projections.
## Core model
```go
type Deck struct {
    ID            string
    ProjectID     string
    Name          string
    Revision      int64
    SchemaVersion int
    Page          PageGeometry
    Theme         ThemeRef
    Sections      []Section
    SlideOrder    []string
    Slides        map[string]Slide
    CreatedAt     time.Time
    UpdatedAt     time.Time
}

type Section struct {
    ID       string
    Name     string
    SlideIDs []string
}

type Slide struct {
    ID          string
    LayoutRef   string
    ObjectOrder []string
    Objects     map[string]VisualObject
    Notes       RichText
    Hidden      bool
}

type VisualObject struct {
    ID        string
    Kind      string // group | text | shape | image | table | chart | line
    ParentID  string
    Transform Transform
    Style     StyleRef
    Content   json.RawMessage
    Locked    bool
}
```
`templateName` is not a Slide field. It belongs to a captured Template Version
or optional materialization provenance.
Representative operations:
```go
type AddSlide struct{ SlideID string; Position int; LayoutRef string }
type MoveSlides struct{ SlideIDs []string; Position int }
type DeleteSlides struct{ SlideIDs []string }
type DuplicateSlide struct{ SourceSlideID, NewSlideID string; Position int }
type AddSection struct{ SectionID, Name string; Start, End int }
type RenameSection struct{ SectionID, Name string }
type SetSectionSlides struct{ SectionID string; SlideIDs []string }
type AddObject struct{ SlideID string; Object VisualObject; Position int }
type PatchObject struct{ SlideID, ObjectID string; Patch ObjectPatch }
type MoveObject struct{ SlideID, ObjectID, ParentID string; ZIndex int }
type DeleteObjects struct{ SlideID string; ObjectIDs []string }
type SetNotes struct{ SlideID string; Notes RichText }
```
There is deliberately no `RenameSlide`.
## Persistence and HTTP
Use `slides`, `slides_changesets`, and `slides_submissions` with the same columns
and CAS/idempotency semantics as Ω-021, replacing snapshot/operation types.
```javascript
POST   /slides
GET    /slides
GET    /slides/:deckID
PATCH  /slides/:deckID
DELETE /slides/:deckID
POST   /slides/:deckID/changes
GET    /slides/:deckID/history
POST   /slides/:deckID/changes/:changeSetID/undo
POST   /slides/:deckID/changes/:changeSetID/redo
GET    /slides/:deckID/descriptor
GET    /slides/:deckID/manifest
GET    /slides/:deckID/slides/:slideID
GET    /slides/:deckID/slides/:slideID/objects
```
## Ordered implementation tasks
1. Freeze schema, coordinate system, limits, operation union, and JSON fixtures.
2. Implement pure apply/validate/inverse logic and structural property tests.
3. Implement SQLite CAS/idempotency/history and store-contract suite.
4. Implement lifecycle/duplicate and the Slides Resource family.
5. Implement descriptor/manifest/slide/object bounded projections.
6. Add centralized access guard, routes, operation modes, History and Agent
	ports.
7. Add live backend suite and architecture/reference companions.
## Security, concurrency, jobs, and observability
- Validate object content by kind; reject unknown executable/embed content.
- Geometry, object counts, nesting depth, text/table size, and response size are
	bounded.
- Mutations serialize per deck in process; revision CAS remains authoritative.
- File references are authorized again on read/materialization.
- Activity logs contain IDs/kinds/counts, not slide text or notes.
- Emit revision conflicts, changed-slide/object counts, snapshot bytes,
	projection latency, and invalid-model code.
## Verification
- Slide IDs survive positional moves; no rename route or operation exists.
- Section range/membership properties under arbitrary moves/deletes.
- Object tree acyclic/z-order deterministic and inverse operations round-trip.
- CAS, idempotency, restart, corruption, negative authorization, and response
	bounds.
- Load: hundreds of slides and thousands of objects with bounded single-slide
	reads.
- Backend E2E: create deck, sections, slides, objects, notes, reorder,
	conflict/retry, history, undo/redo, reload.
## Migration and rollback
Additive tables/routes; register the Resource family only after conformance is
green. Rollback unregisters and parks tables. Schema-version upgrades require
golden down-read tests or a backup before incompatible writes.
## Completion evidence
- Resource/store/transport/history/live suites pass.
- Schema and operation reference published.
- Backend E2E proves no Slide-name concept leaked into the API.
- No non-FOSS dependency introduced.
## Sources
- Taurus Yesod Model — Slides capability
- Slides Context/Inspector Panel pages
- `core/capability/document` revision/history patterns
- `core/capability/resource`
- `core/transport/dispatch.go`
---


---
title: "Work Packet — Ω-023 — Implement the Slides aggregate, operations, and persistence"
notion_page_id: "3acb6410e50281909acdce415f06e0db"
notion_url: "https://app.notion.com/3acb6410e50281909acdce415f06e0db"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:59:20Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-023 — Implement the Slides aggregate, operations, and persistence

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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


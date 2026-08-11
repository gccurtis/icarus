---
title: "Work Packet — Ω-024 — Complete Slides content, templates, rendering, and API integration"
notion_page_id: "3acb6410e5028144837de6ca4b89ccbe"
notion_url: "https://app.notion.com/3acb6410e5028144837de6ca4b89ccbe"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-29 23:59:38Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-024 — Complete Slides content, templates, rendering, and API integration

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

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


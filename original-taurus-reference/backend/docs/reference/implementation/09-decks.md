# Stage 09 — Decks

## Outcome

Build backend-owned Decks with ordered Slides, layouts/masters/themes, stable
elements, text/images/charts/placeholders, speaker notes, bindings, family
templates, collaboration, extraction, and deterministic rendered previews.

## Non-goals

- Fabric.js or any browser canvas as canonical state
- PPTX translation
- silent best-effort layout changes
- image/model clients inside Decks
- generated content automatically becoming evidence

## Target tree and files

```text
internal/
  capabilities/resources/decks/
  cell/handlers/decks/
  cell/handlers/decks/{repository.go,mysql/}
  wiring/{testing,development,production}/decks.go
migrations/project/*_decks.sql
api/openapi/product-v1.yaml
test/{integration,recovery,golden}/decks/
```

## Versioned contracts and schemas

Register only the exact operations in
[Decks](../capabilities/decks.md#commands-and-queries). Schemas version Deck,
Slide, theme/layout/master, closed element kinds, geometry/style, bindings,
speaker notes, render refs, family history and Collaboration anchors. Unknown
element, theme, binding, render or representation versions fail closed. The
seven Deck Template operations are registered from
[Translation and Templates](../capabilities/translation-and-templates.md#family-templates),
not from a generic Template API.

## Canonical model

- Deck metadata, page geometry, theme/design-system version;
- layout/master definitions and stable placeholders;
- ordered Slides with stable IDs and layout overrides;
- elements: text frame, image, shape, line/connector, table, chart, metric,
  group, and explicit unsupported future kind;
- canonical geometry, z-order, grouping, style, crop, accessibility text;
- closed declarative Slide transitions and stable element-animation timelines
  with exact revisions, bounded timing and reduced-motion fallback;
- authored text and prompt/formula/data/asset bindings with last-good display;
- speaker notes, family-native Collaboration anchor/rebase semantics,
  references/provenance; comment/private Note records remain Stage 12-owned;
- render version/digest and family change history; and
- Deck templates with parameters and instantiation policy.

## Operations

- create blank/from Deck template or exact-version same-Project Deck duplicate
  under a new independent identity;
- add/duplicate/delete/reorder Slide;
- apply/change layout and theme under compatibility checks;
- set/remove declarative Slide transitions and create/update/reorder/tombstone
  stable element animations with a deterministic reduced-motion projection;
- insert/update/remove/group/ungroup/align/distribute/order elements;
- edit text, style, geometry, crop, accessibility and notes;
- bind/unbind/refresh Formula, data, Resolution, or asset content;
- validate/rebase a Collaboration anchor without storing comment/Note content;
- extract authored/displayed text with generated markers;
- render exact Slide/Deck preview and deterministic JSON/Markdown outline
  through bounded read-only `decks.render.v1`; an over-bound render returns
  `deck_render_async_required` without side effects, while
  `decks.render_jobs.request.v1` admits the frozen exact durable render and
  `decks.render_jobs.status.get.v1` observes typed result metadata.

## Ports

Deck-owned ports for asset metadata/bytes, Formula value, Project data asset, Prompt
Resolution, and a bounded rendering implementation. Provider adapters remain
outside the capability. Generated image behavior, when added, goes through
Resolution/Intelligence and Files, then Deck receives an authorized asset
reference.

## Persistence/concurrency

Deck edits use stable Slide/element/property addresses and expected revisions.
Disjoint Slide or property edits can reconcile; deletion versus edit, grouping
versus movement, layout replacement, and overlapping text edits require
explicit semantic rules. Rendering is a fenced job keyed by exact Deck/theme/
asset/font versions; stale renders never become current.

The interactive render Query never writes or changes request class. The
separate idempotent durable request freezes exact Deck/Slide/theme/asset/font
revisions, scene/format options and renderer policy version and commits its
Job/work receipt/idempotency/Audit envelope. Status is read-only; a ready render
is Deck-owned typed result metadata, while File publication remains
Translation/Files work. Ask cannot submit the durable request.

## Request, authority, failure, and recovery

The bound handler authorizes the Deck/component, loads one consistent view,
adapts exact asset/Formula/Data/Resolution inputs, calls the capability, then
consumes a fresh permit and atomically commits state, idempotency, required
Project Audit and render jobs. Conflicts identify stable Slide/element/property
versions. Recovery reclaims jobs, discards stale renders and restores canonical
history from Project backup. Renderer/font/asset failure preserves last-good.

## Production and test composition

Production requires durable persistence and a pinned deterministic renderer/
font/asset environment for advertised previews. Missing adapters make their
operations unavailable. Pure scene tests use deterministic ports; live database
concurrency, crash, render, restore and golden evidence precede promotion.

## Proof matrix

- geometry/style/group/z-order/layout/theme invariants;
- stable identities through movement/reorder/grouping;
- independent-Cell disjoint/conflicting edits;
- bindings retain last good with visible stale/error;
- extraction prevents generated-output feedback;
- font/asset absence and renderer failure are explicit;
- deterministic per-Slide rendered golden images/digests in the pinned
  environment plus JSON/Markdown outline;
- bounded render zero-write, `deck_render_async_required`, durable-request
  replay/restart/status and typed-result ownership proofs;
- template instantiation and Collaboration anchor validation/rebase; comment/
  private Note content and access remain Stage 12 proofs;
- all seven Deck Template surfaces enforce exact-version lifecycle, stripping,
  requirements, lineage and ordinary Deck invariants;
- crash/retry/idempotency/permit/Audit and render fencing; and
- live canonical reconstruction and backup/restore.

## Completion boundary

Deck structure and rendering are backend-complete. Browser authoring and PPTX
translation remain separate stages.

## Consequential decisions and source grounding

- **Backend scene state is canonical; browser canvas state is not.** Headless
  rendering and independent clients must agree.
- **Deck owns displayed/last-good binding state.** Providers cannot mutate Deck
  tables.
- **Collaboration owns comments/private Notes.** Deck supplies anchor
  validation/rebase only.

Grounding: [Deck capability](../capabilities/decks.md),
[resource-mutation flow](../flows/resource-mutation.md), and
[Translation and Templates](../capabilities/translation-and-templates.md).

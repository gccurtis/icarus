# Decks

## Purpose

Decks provides backend-owned presentation Resources: ordered Slides, reusable
themes/layouts, stable editable elements, speaker notes, data/prompt bindings,
deterministic scene projection, presentation mode and explicit import/export.
The browser canvas and any third-party presentation editor are replaceable
adapters over canonical Deck state.

### Owns

- Deck identity, lifecycle, representation version, theme/layout catalog and
  ordered stable Slide identities.
- Stable slide elements, geometry, styles, groups/layers, animations/transitions
  metadata, speaker notes and family-native anchors.
- Prompt, Formula, Workbook/data and File bindings with exact source versions,
  normalized provenance, stale state and last-good display/scene values.
- Deck-order, theme/layout, Slide and element revision semantics.
- Deck-specific templates, outline/extraction, render scene and loss model.

### Does not own

- File bytes, font binaries, Formula evaluation, Workbook data, Knowledge,
  model providers, comments, SQL, jobs, transport, authority or required Audit.
- Frontend selection, drag state, pixel buffers or presentation-window state.
- A generic shape or template capability shared by unrelated Resources.

## Supported feature contract

| Feature | Required behavior | Canonical boundary |
| --- | --- | --- |
| Slides and order | Create, duplicate, remove, reorder, hide and section Slides with stable identities | Deck order revision |
| Themes and layouts | Versioned design tokens, fonts, colors, masters/layouts, placeholders and inheritance with cycle-free resolution | Deck theme/layout catalog |
| Elements | Text frames, images, shapes, lines, tables, charts, media, groups and bound/prompt elements use stable IDs and closed kinds | Slide element graph |
| Geometry and layering | Position, size, rotation, crop, alignment, distribution, grouping and z-order are canonical deterministic values | Element and Slide revisions |
| Rich text | Structured paragraphs/runs, lists, marks, links, fit/overflow and placeholder semantics | Text element payload |
| Speaker notes | Authored notes and references remain distinct from visible slide content | Slide notes revision |
| Prompt-driven content | Prompt text/visual suggestions retain exact input/evidence/artifact and last-good accepted display | Binding/result state, not provider payload |
| Live data and Formula | Text, metrics, tables and charts bind to exact Formula/Workbook/data outputs; failure preserves last-good scene | Versioned binding and scene |
| Sources/provenance | Elements expose authored/imported/inferred/bound origin and exact source versions | Server-stamped provenance |
| Presentation | Headless scene and notes/order projections support a browser presenter without making it canonical | Exact Deck revision set |
| Transitions and animation | Declarative closed Slide transitions and stable element-animation timelines with duration/delay/easing/trigger/order plus deterministic reduced-motion fallback | Slide transition revision and AnimationID revisions; no executable script |
| Comments | Slide/element/text anchors validate and rebase through Deck semantics | Anchor only; threads remain Collaboration-owned |
| Templates | A canonical Deck version plus parameters/layout rules instantiates a new Deck | Family-owned template metadata |
| Import/export | PPTX/PDF/native/JSON adapters preserve or report unsupported features explicitly | Translation around exact Deck version |

## Canonical domain model

| Type | Required content and invariant |
| --- | --- |
| `Deck` | `DeckID`, name, lifecycle, representation version, dimensions, theme/layout catalog, ordered Slide IDs, metadata/order revisions and attribution |
| `Slide` | Stable `SlideID`, layout reference/version, background, transition, visibility, section, element order, notes and Slide revision |
| `Theme` | Stable ThemeID, versioned color/font/spacing/effect tokens and optional parent; inheritance is acyclic and deterministic |
| `Layout` | Stable LayoutID, theme version, placeholder definitions and default elements; placeholder IDs/kinds are unique |
| `Element` | Stable ElementID, closed versioned kind, transform, bounds, style, visibility, lock metadata, provenance, element revision and kind payload |
| `TextFrame` | Structured paragraphs/runs and list/style references with deterministic overflow/fit policy; editor DOM is excluded |
| `ImageElement` | Exact opaque File/asset version, crop/fit, alt text and rendition policy; no object key/URL |
| `ShapeElement` | Closed geometry kind, fill/stroke/effects and optional text; arbitrary executable paths are forbidden |
| `TableElement` | Stable row/column/cell IDs, spans, cell text/style or exact data binding |
| `ChartElement` | Versioned chart grammar, series/axes/legend/style, exact source binding and normalized last-good scene data |
| `Group` | Ordered child Element IDs; one parent maximum, no cycles and transform composition is deterministic |
| `TransitionSpec` | Closed transition kind, bounded duration/easing/direction/options, transition revision and explicit reduced-motion fallback; no executable callback or provider payload |
| `AnimationStep` | Stable AnimationID, exact target Element IDs/properties, closed effect kind, trigger (`on_enter`, `with_previous`, `after_previous`, or admitted presenter action), order, delay/duration/easing, iteration bound, accessibility fallback and revision |
| `AnimationTimeline` | Ordered stable AnimationIDs for one Slide; every target exists on that Slide, overlapping property writes are explicitly ordered, total duration/step count are bounded and cycles are impossible |
| `ContentBinding` | Kind, exact source Resource/object/version, parameters, expected render contract, last-good value/scene, evidence and state |
| `DeckAnchor` | Exact Deck revision set plus Slide/Element/text-range target; never only canvas coordinates |
| `DeckScene` | Normalized deterministic layout projection with exact source revisions and explicit unsupported/warning list |
| `DeckRenderResult` | Immutable request/result IDs, exact Deck/Slide/theme/layout/asset revision lineage, closed scene/outline/print kind, renderer/policy versions, digest, size, warnings and opaque family result reference; no File or delivery URL |

Geometry uses bounded fixed-point values in Deck units; persisted behavior does
not depend on platform floating-point formatting. All references are stable
IDs. A theme/layout update does not rewrite every element: effective style is a
deterministic resolution over exact versions, and any materialized scene records
those versions.

## Commands and queries

| Product operation | Kind | Capability behavior |
| --- | --- | --- |
| `decks.create.v1` | Idempotent command | Create a bounded Deck and initial Slide, optionally from a validated template |
| `decks.duplicate.v1` | Idempotent command | Freeze one authorized exact Deck revision set and create an independent same-Project Deck identity/content graph with bounded provenance; no grants, comments or private state are copied |
| `decks.rename.v1` | Command | Rename under expected metadata revision |
| `decks.set_lifecycle.v1` | Command | Archive/restore/tombstone under retention policy |
| `decks.add_slide.v1` | Idempotent command | Add or duplicate one Slide at a stable order anchor |
| `decks.update_slides.v1` | Idempotent command | Reorder/hide/section/remove bounded Slides under expected order/Slide revisions |
| `decks.upsert_theme.v1` | Idempotent command | Create/update a theme/layout and validate inheritance/placeholders |
| `decks.add_elements.v1` | Idempotent command | Add bounded typed elements to one Slide with stable IDs/order anchors |
| `decks.update_elements.v1` | Idempotent command | Apply typed property/content/geometry/group/order edits with exact expected revisions |
| `decks.remove_elements.v1` | Idempotent command | Remove elements under explicit group/reference cascade policy |
| `decks.set_notes.v1` | Command | Replace/patch speaker notes under exact notes revision |
| `decks.set_transition.v1` | Idempotent command | Set/remove one closed Slide transition under exact Slide/transition revision and reduced-motion fallback validation |
| `decks.upsert_animation.v1` | Idempotent command | Create/update/reorder one stable declarative AnimationStep under exact Slide/timeline/target revisions and bounded overlap rules |
| `decks.remove_animation.v1` | Idempotent command | Tombstone one exact AnimationID under expected timeline/item revision; animation IDs are not reused |
| `decks.resolve_binding.v1` | Durable command | Obtain prompt/Formula/data output outside transaction and conditionally store exact normalized result |
| `decks.get.v1` | Query | Return metadata, exact revision map and a bounded Deck projection |
| `decks.get_slide.v1` | Query | Return one exact Slide with effective theme/layout references |
| `decks.outline.v1` | Query | Return deterministic slide titles/text/notes summary under caller action |
| `decks.render.v1` | Query | Return a bounded normalized scene JSON, semantic outline or print/presentation scene at exact revisions without creating an artifact |
| `decks.render_jobs.request.v1` | Idempotent durable command | Freeze the exact Deck revision map, scene/format options and policy version and admit a durable render Job |
| `decks.render_jobs.status.get.v1` | Query | Return bounded safe Job state and, when ready, typed Deck-render result metadata for that exact request |
| `decks.extract.v1` | Query | Produce exact-version authored text/tables/descriptions and stable anchors for Knowledge |
| `decks.validate_anchor.v1` | Query | Validate/rebase Collaboration/source anchors across revisions |

`decks.render.v1` is always a bounded read-only query. It cannot create a Job,
WorkAuthority, render object, idempotency record or Audit mutation. If the
exact Slide/element/theme/layout/animation revision map exceeds interactive
slide, element, byte or time bounds, it returns
`deck_render_async_required`, naming `decks.render_jobs.request.v1`, with no
side effects. The durable request freezes that exact revision map, scene or
presentation format, transition/animation policy, asset dependencies, render
options and renderer-policy version before committing its request, Job,
receipt and Audit envelope through the ordinary durable-work protocol. Its
status query is read-only; a ready response supplies typed scene/outline/print
result metadata, digest, size, renderer version and exact input/dependency
lineage. Translation owns creation of an exported File. Ask may call only the
bounded query when admitted and dispatch never auto-upgrades it to the durable
request command.

Presentation playback is a query of exact scene/order/transition metadata, not
a mutation. Import translates PPTX/native input into the same typed create/edit
operations. Export reads one exact revision map, reports loss and creates a File.

## Capability API and ports

Pure operations validate and transform Decks, Slides, themes/layouts, element
graphs and typed patches; resolve effective styles; apply exact binding results;
build deterministic outline/extraction; validate anchors; and produce a
normalized scene.

Consumer-owned ports include only external needs:

```go
type DeckContentProvider interface {
    Resolve(context.Context, DeckContentRequest) (DeckContentResult, error)
}

type DeckAssetProvider interface {
    ResolveExact(context.Context, DeckAssetRequest) (DeckAsset, error)
}
```

`DeckContentRequest` expresses a prompt, typed Formula value, Workbook range,
analytic result or named Resource projection in Deck vocabulary, with exact
source/dependency versions and render constraints. Handler adapters use bounded
nested dispatch to the applicable capability. Results are normalized text,
table, scalar, image/asset reference or chart-scene values plus provenance;
unknown kinds fail closed.

The handler owns Project-bound repositories/transactions, consistent revision
loads, conditional writes, idempotency, permit/Audit, render/export jobs and
format/provider adapters.

## Persistence and concurrency

Decks uses conditional revisions rather than Document ChangeSets:

- Deck metadata/order revision;
- theme/layout catalog revision and individual object revisions;
- one Slide revision for background/layout/notes/element-order changes;
- one revision per Element, including explicit content/geometry/style property
  expectations in typed update commands; and
- one transition revision and one ordered animation-timeline revision per
  Slide, plus retained revisions/tombstones per AnimationID.

Independent edits to different Slides/elements can commit concurrently. A
same-element update conflicts unless typed patches touch disjoint properties
whose expected property revisions still match. Multi-element align/distribute,
group/ungroup, z-order and delete commands are atomic and lock affected IDs in
canonical order. Slide reorder serializes on the Deck order revision. Theme or
layout edits validate descendants and conditionally advance the catalog
revision; scenes derived from an older theme are stale, not canonical.
Transition/animation commands lock the Slide timeline and exact target
elements. Concurrent edits to unrelated Slides may commit; edits to the same
animation/order or an animated target property conflict. Element removal must
explicitly reject or cascade its animation references. Playback is a pure
projection of the exact timeline; it never commits presenter timing state.

Every command validates all references and computes the next plain state before
requesting a fresh permit. The transaction revalidates exact revisions and
authority, consumes the permit, persists all affected objects, idempotency and
Audit together, and enqueues any follow-up render/extraction fact. A conflicting
revision returns bounded context; it never silently overwrites.

Prompt/data/Formula resolution and expensive render/export run outside the
mutation transaction. Result commit includes the exact element binding and all
source/theme/layout revisions. Stale results are rejected while last-good scene
data and a visible stale/error marker remain. Cached scenes are rebuildable and
never replace the canonical element graph.

An asynchronous effectful `decks.resolve_binding.v1` preselects stable
binding-work, `WorkAuthorityID` and `JobID` values. Control creates pending work
under the current session; one session-permitted Project transaction stores
intent, Job, non-authoritative receipt, idempotency, Audit/fact and
`durable_job@1`, and trusted exact-receipt acknowledgement activates it. Pending
authority/bare receipt cannot issue a permit; missing receipt expires and lost
acknowledgement reconciles only from trusted placement. Each canonical Deck
result commit uses a fresh work-sourced permit. Current-family sign-out
preserves admitted work; broader authority/cancel/expiry revocation denies/
fences it. The finalizer can change only Job bookkeeping, never Deck/binding
state or provider/render effects.

## Security, failure and stable errors

Deck reads can independently gate speaker notes, hidden Slides, prompt source,
source evidence and referenced File metadata. Imported active content, macros,
external links, embedded executables and remote fetches are denied or
quarantined according to explicit Translation policy; rendering never executes
them. Transitions/animations are a closed declarative grammar: no script,
callback, arbitrary CSS/HTML, network fetch, unbounded loop or hidden active
content can be persisted. Every step has an accessible final state and a
deterministic reduced-motion projection.

| Family error | Kernel category | Meaning/retry |
| --- | --- | --- |
| `deck_invalid_model` | `invalid_argument` | Invalid theme/layout/element/geometry/group/order or bounds |
| `deck_unknown_kind` | `unsupported_version` | Unsupported representation, element, chart, transition or scene kind |
| `deck_conflict` | `conflict` | Expected Deck/Slide/element/property revision changed |
| `deck_broken_reference` | `precondition_failed` | Theme/layout/placeholder/group/source/asset target no longer resolves |
| `deck_cycle` | `precondition_failed` | Theme inheritance or group/reference cycle |
| `deck_animation_invalid` | `invalid_argument` | Timeline target/effect/trigger/order/duration/overlap or reduced-motion fallback violates the closed contract |
| `deck_stale_binding` | `conflict` | Content result no longer matches binding/source/theme revisions |
| `deck_render_async_required` | `precondition_failed` | Exact render exceeds interactive bounds; call `decks.render_jobs.request.v1`; no Job, work or artifact was created |
| `deck_render_unsupported` | `unsupported_version` | Strict scene/export cannot preserve a canonical feature |
| `deck_too_large` | `invalid_argument` | Slide/element/asset/render budget exceeded |
| `deck_integrity_failure` | `integrity_failure` | Persisted revisions/order/graph violate canonical invariants |
| `deck_translation_loss` | `precondition_failed` | Strict import/export requires an accepted loss report |

Provider failures never clear canonical authored content or last-good bound
display. All mutations use current authority, exact scope, a fresh one-use
permit and atomic required Audit.

## Cross-capability relationships

- Files supplies exact images/media/fonts where policy permits and stores
  exports; Decks stores opaque version references only.
- Formula, Workbooks/Data and Resolution satisfy `DeckContentProvider` through
  handlers. Decks owns the binding and normalized presentation result.
- Knowledge acquires authored text, tables and approved image descriptions from
  `decks.extract.v1`. Bound/inferred display is labeled and excluded from
  re-ingestion by default.
- Collaboration validates Slide/Element/text anchors. Translation owns PPTX,
  PDF and native-package codecs. Agents submit ordinary Deck commands or
  reviewable typed proposals.
- Deck Template publication and instantiation use the seven family-owned
  `decks.templates.*.v1` operations defined by
  [Translation and Templates](translation-and-templates.md#family-templates).

## Headless proofs and examples

```text
create deck "Launch" -> order r0, slide S1 r0
add title T1 and chart C1 bound to Workbook table@r7
resolve C1 -> normalized scene@table-r7, element C1 r1
concurrently edit T1 text and move C1 -> both commit
change table to r8 -> Deck remains valid, C1 reports stale with last-good scene
render --format scene-json -> byte-stable geometry/style/text/source versions
```

Required proofs include:

- model, closed-kind, fixed-point geometry, theme/layout/group graph and
  reference invariants with fuzz/property tests;
- concurrent independent/same-property, group, z-order, slide-order and theme
  revisions against a live Project Database;
- transition/animation timeline ordering, target removal, overlap conflict,
  exact playback scene, total-duration bounds and reduced-motion goldens;
- deterministic effective-style, text outline, extraction and scene goldens;
- stale binding/provider timeout preserves last-good scene;
- all seven Deck Template preview/publish/get/list/plan/instantiate/lifecycle
  surfaces enforce
  stripping, exact version requirements, lineage and ordinary Deck creation;
- exact idempotency, crash boundaries, revocation race and effect/Audit
  atomicity;
- hostile PPTX/native packages, external links, zip expansion and unsupported
  features produce bounded loss/security results;
- bounded render query proves zero Job/work/artifact/idempotency writes and
  exact async-required routing; durable render request/status proves frozen
  revisions, typed metadata, lease loss and stale output fencing; and
- headless create/edit/bind/present/export through the same Product operations.

## Source grounding

- [SOL X 28 — Decks](https://app.notion.com/p/39ab6410e50281a79849c7e55ef42af9)
- The original [Taurus Product Vision](https://app.notion.com/p/377b6410e50280c69389e5763939cbf0)
  defines ordered Slides, layouts/masters, shapes, prompt text, charts,
  sources, presentation and export. It is vision evidence; no verified Deck
  construction existed.
- Omega's [experience map](../product/experience-map.md) and
  [repository map](../architecture/repository-map.md) establish `decks` as the
  Resource family and Slides as contained aggregates.
- The current [capability](../architecture/capability-model.md) and
  [persistence](../architecture/persistence-and-concurrency.md) contracts
  establish backend truth, consumer-owned ports and conditional revisions.

### Nova evidence (pinned)

- Nova's resource/tab workspace and generated Product contract are useful
  evidence for addressable Resource integration and transport versioning. The
  audited tree at
  [`3df790b2`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova)
  contains no canonical Deck/Slide backend; the
  [`resource` registry](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/resource)
  composes only a legacy Document family reference. Decks is therefore a new
  Omega contract, not completed Nova behavior or compatibility authority.

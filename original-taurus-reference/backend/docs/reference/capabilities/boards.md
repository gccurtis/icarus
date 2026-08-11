# Boards

## Purpose

Boards provides a backend-owned spatial Resource for freeform whiteboards and
structured dashboards. It owns a stable canvas graph, elements, connectors,
groups, layers, views, grid/page policy, data/prompt bindings, deterministic
scene projection and Board-specific concurrency. The frontend canvas is an
interaction and rendering adapter only.

### Owns

- Board identity, lifecycle, representation version, Whiteboard/Dashboard mode,
  canvas/page/grid/theme settings and named views.
- Stable elements, geometry, styles, layers, groups and connector topology.
- Authored text/ink and exact-version bound values with normalized provenance,
  state and last-good display.
- Board-structure, element, connector and view revision semantics.
- Board templates, semantic extraction, deterministic JSON/SVG scene and
  family-native comment anchors.

### Does not own

- Workbook/Formula/Knowledge/model truth, File bytes, comments, browser camera
  or selection, SQL, jobs, authority, required Audit or provider SDK state.
- A continuously running collaboration loop or canonical presence state.
- Generic UI widgets. Every persisted element kind has Board semantics and a
  versioned serializable payload.

## Supported feature contract

| Feature | Required behavior | Canonical boundary |
| --- | --- | --- |
| Whiteboard mode | Bounded infinite-canvas coordinates, pan/zoom-independent content, frames and free placement | Board canvas settings and element geometry |
| Dashboard mode | Bounded printable page, grid snapping, layout constraints and deterministic responsive view rules | Board page/grid/view definitions |
| Elements | Text, sticky, shape, image, ink, table, chart, metric, frame, embed and group elements use stable IDs | Closed Board element graph |
| Connectors | Stable source/target ports, optional free endpoints, routing/style/labels and explicit detach/cascade behavior | Connector graph |
| Editing tools | Move, resize, rotate, style, group, layer, align, distribute, duplicate and lock bounded selections | Typed atomic element commands |
| Data widgets | Tables/charts/metrics bind to exact Workbook/Data/Formula outputs with last-good scenes and stale state | Binding plus normalized result |
| Prompt content | Generate or refresh bounded text/image/diagram suggestions with evidence; acceptance is an explicit Board mutation | Prompt binding/proposal state |
| Images and files | Exact File/asset versions, safe renditions, captions and alt text | Opaque version reference; bytes remain Files-owned |
| Views | Named camera/filter/layer/dashboard views are durable; live viewport and selection are transient | Board view records |
| Sources/provenance | Authored/imported/inferred/bound origin is inspectable at exact versions | Server-stamped element/binding provenance |
| Comments | Element, connector, frame and text-range anchors validate/rebase | Anchor semantics only |
| Templates | Board version plus mode/grid/theme/parameter metadata instantiates a Board | Family-specific template metadata |
| Render/export | Canonical JSON and deterministic SVG; PNG/PDF/native adapters read exact version and report loss | Scene projection, never screenshot truth |

## Canonical domain model

| Type | Required content and invariant |
| --- | --- |
| `Board` | `BoardID`, name, lifecycle, representation version, mode, canvas/page/grid/theme, ordered layer IDs, structure revision and attribution |
| `Layer` | Stable LayerID, order, visibility, lock metadata and revision; element membership is unambiguous |
| `Element` | Stable ElementID, closed kind, layer/parent, transform/bounds, style, visibility/lock, provenance, element revision and kind payload |
| `Transform` | Bounded fixed-point position, size, rotation and optional affine parameters; no platform-dependent float encoding |
| `TextElement` / `Sticky` | Structured bounded text and style; sticky adds semantic color/status metadata |
| `ShapeElement` | Closed geometry kind, fill/stroke/effects and optional text/ports |
| `InkElement` | Bounded normalized point/pressure segments and simplification version; raw device events are not canonical |
| `Table` / `Chart` / `Metric` | Authored data or exact content binding, normalized last-good value/scene and render contract |
| `Frame` | Named bounded region with optional child containment and presentation order; containment is acyclic |
| `Group` | Ordered children and transform; one parent maximum and no group/frame cycle |
| `Connector` | Stable ConnectorID/element, exact endpoints/ports or free points, routing kind, control points, labels/style and revision |
| `ContentBinding` | Exact source Resource/object/version, kind, parameters, expected result type, provenance/evidence, state and last-good display |
| `BoardView` | Stable ViewID, name, mode-compatible camera/page, visible layers/filter and revision; never grants authority |
| `ElementDuplicationPlan` | Bounded exact source element/connector subgraph, expected revisions, target layer/parent/order, deterministic offset, freshly allocated IDs, internal-reference remap and explicit external-reference policy |
| `BoardAnchor` | Exact Board version plus stable element/connector/text target; raw screen coordinates alone are invalid |
| `BoardScene` | Deterministic normalized scene with exact Board/source revisions and explicit warnings/unsupported list |
| `BoardRenderResult` | Immutable request/result IDs, exact Board/layer/element/binding revision lineage, closed JSON/SVG/print-scene kind, renderer/policy versions, digest, size, warnings and opaque family result reference; no File or delivery URL |

Coordinates use signed fixed-point Board units and declared maximum extents.
Geometry, connector routing and scene ordering are deterministic for the same
canonical input. A dashboard constraint cannot move an element silently: the
command returns the resulting canonical geometry or a conflict.

## Commands and queries

| Product operation | Kind | Capability behavior |
| --- | --- | --- |
| `boards.create.v1` | Idempotent command | Create bounded Board in declared mode, optionally from validated template |
| `boards.duplicate.v1` | Idempotent command | Freeze one authorized exact Board revision set and create an independent same-Project Board identity/content graph with bounded provenance; no grants, comments or private state are copied |
| `boards.rename.v1` | Command | Rename under metadata revision |
| `boards.set_lifecycle.v1` | Command | Archive/restore/tombstone under retention policy |
| `boards.set_mode.v1` | Command | Change Whiteboard/Dashboard settings with explicit geometry conversion plan/loss report |
| `boards.update_canvas.v1` | Command | Update page/grid/theme/layers under expected structure revisions |
| `boards.add_elements.v1` | Idempotent command | Add typed stable elements at declared layer/order/parent |
| `boards.duplicate_elements.v1` | Idempotent command | Clone one bounded exact element/connector subgraph under fresh IDs, remap every internal edge, and apply the declared reject/detach/preserve external-reference policy atomically |
| `boards.update_elements.v1` | Idempotent command | Apply bounded typed geometry/content/style/property patches under exact revisions |
| `boards.remove_elements.v1` | Idempotent command | Remove with explicit `reject_if_referenced`, `detach`, or `cascade` policy |
| `boards.connect.v1` | Idempotent command | Add/update/remove connectors after endpoint/graph validation |
| `boards.arrange.v1` | Idempotent command | Atomically group/ungroup/order/align/distribute a bounded stable selection |
| `boards.upsert_view.v1` | Idempotent command | Create/update/delete a named durable view; live camera remains client state |
| `boards.resolve_binding.v1` | Durable command | Resolve exact prompt/data/Formula input and conditionally store normalized result |
| `boards.get.v1` | Query | Return metadata, exact revisions and bounded scene/object projection |
| `boards.get_elements.v1` | Query | Return exact requested IDs or bounded spatial region without implying omitted content |
| `boards.render.v1` | Query | Return bounded canonical JSON/SVG or a normalized print scene at one exact revision set without creating an artifact |
| `boards.render_jobs.request.v1` | Idempotent durable command | Freeze the exact Board revision map, spatial/scene target, format/options and policy version and admit a durable render Job |
| `boards.render_jobs.status.get.v1` | Query | Return bounded safe Job state and, when ready, typed Board-render result metadata for that exact request |
| `boards.extract.v1` | Query | Produce authored text, tables, accepted image descriptions and stable anchors for Knowledge |
| `boards.validate_anchor.v1` | Query | Validate/rebase Collaboration/source anchor across revisions |

`boards.render.v1` is always a bounded read-only query and cannot create a
Job, WorkAuthority, render object, idempotency record or Audit mutation. If
the exact layer/element/connector/binding revision map and requested spatial
extent exceed interactive element, point, byte or time bounds, it returns
`board_render_async_required`, naming `boards.render_jobs.request.v1`, with no
side effects. The durable request freezes that exact revision map, target
extent/view, scene or SVG/print format, asset dependencies, render options and
renderer-policy version before committing its request, Job, receipt and Audit
envelope through the ordinary durable-work protocol. Its status query is
read-only; a ready response supplies typed JSON/SVG/print-scene result
metadata, digest, size, renderer version and exact input/dependency lineage.
Translation owns creation of an exported File. Ask may call only the bounded
query when admitted and dispatch never auto-upgrades it to the durable request
command.

Mode conversion is never a boolean flip when geometry would change. The command
must carry an explicit deterministic conversion proposal and strict/accept-loss
choice. Import/export follows the same rule.

## Capability API and ports

Pure operations validate and mutate the element/connector graph; calculate
group transforms, alignment, distribution and mode constraints; apply exact
binding results; resolve deterministic layer/scene order; extract semantic
content; and validate/rebase anchors.

```go
type BoardContentProvider interface {
    Resolve(context.Context, BoardContentRequest) (BoardContentResult, error)
}

type BoardAssetProvider interface {
    ResolveExact(context.Context, BoardAssetRequest) (BoardAsset, error)
}
```

The content request is a closed Board vocabulary for prompt text/image,
Formula scalar, Workbook/Data table/chart or Knowledge artifact, with exact
source revisions and scene constraints. The normalized result contains only
serializable text/scalar/table/asset/scene data, provenance and evidence.
Adapters outside the capability invoke the applicable sibling through nested
dispatch.

Handlers own Project-bound repositories, spatial-query adapters, conditional
transactions, idempotency, permit/Audit, durable render/resolution jobs and
format adapters. Spatial indexes are rebuildable projections, not canonical
Board state.

## Persistence and concurrency

Boards uses:

- one Board structure revision for mode, page/grid/theme and layer order;
- one revision per Layer, View and Element/Connector;
- typed element property expectations for mergeable disjoint updates; and
- immutable binding/render evidence keyed to exact input digest, with a
  conditional current-result reference.

Independent elements may update concurrently. A same-element authored content
or same-property edit conflicts. Geometry, style and content may merge only
when the typed command touches disjoint revisioned property groups. Atomic
multi-element commands lock affected layers/elements/connectors in stable ID
order and validate the graph after the whole proposed change.

Connector endpoints, group/frame membership and layer order participate in the
same transaction as an affected mutation. Removing an element requires the
declared reference policy; no implicit orphan, detach or cascade is allowed.
Element duplication locks the complete declared source subgraph and target
layer/parent, allocates fresh IDs server-side, remaps internal connectors/group/
frame/binding references, and applies an explicit policy to any edge leaving
the selection. It never aliases mutable element state or silently clones
comments, private state, Tasks, provider work or external Resource identity.
Board mode/layer changes serialize at the structure revision. Spatial queries
read one consistent revision map and return it to the caller.

After pure validation, the handler obtains a fresh permit and atomically
revalidates revisions/authority, consumes the permit, persists all affected
records, idempotency and required Audit, then enqueues any derived
render/extraction hint. No database-wide or application-wide canvas lock exists.

Provider/render work happens outside the mutation transaction. A result can
commit only when the binding, target element and exact source revisions remain
current. Otherwise it is stale and last-good display stays visible. Cache,
spatial index and notifications may all be absent without changing correctness.

An asynchronous effectful `boards.resolve_binding.v1` preselects stable
binding-work, `WorkAuthorityID` and `JobID` values. Control creates pending work
under the current session; a session-permitted Project transaction stores the
intent/Job/non-authoritative receipt/idempotency/Audit/fact plus
`durable_job@1`, and trusted exact-receipt acknowledgement activates it. Pending
authority/bare receipt cannot issue a permit; missing receipt expires, and lost
acknowledgement reconciles only from trusted placement. Each Board result commit
uses a fresh work-sourced permit. Current-family sign-out preserves admitted
work; broader authority/cancel/expiry revocation denies/fences it. The finalizer
can change only Job bookkeeping, never Board/binding state or provider/render
effects.

## Security, failure and stable errors

Embeds cannot execute arbitrary scripts or fetch arbitrary network locations.
They reference approved exact Resources/assets or a connector projection whose
handler enforces policy. SVG/image import is sanitized. Hidden/locked layers,
prompt source/evidence and referenced asset metadata require explicit actions.

| Family error | Kernel category | Meaning/retry |
| --- | --- | --- |
| `board_invalid_model` | `invalid_argument` | Invalid geometry, element, layer, endpoint, group, view or bounds |
| `board_unknown_kind` | `unsupported_version` | Unsupported representation/element/connector/scene kind |
| `board_conflict` | `conflict` | Expected structure/element/property revision changed |
| `board_broken_reference` | `precondition_failed` | Endpoint, child, source, asset, layer or view target no longer resolves |
| `board_cycle` | `precondition_failed` | Group/frame/reference graph would cycle |
| `board_stale_binding` | `conflict` | Provider result no longer matches target/source revisions |
| `board_conversion_loss` | `precondition_failed` | Mode/import/export conversion requires explicit accepted loss |
| `board_render_async_required` | `precondition_failed` | Exact render exceeds interactive bounds; call `boards.render_jobs.request.v1`; no Job, work or artifact was created |
| `board_render_unsupported` | `unsupported_version` | Strict renderer cannot preserve a canonical feature |
| `board_too_large` | `invalid_argument` | Element/point/extent/result budget exceeded |
| `board_integrity_failure` | `integrity_failure` | Persisted revisions/graph/spatial metadata violate invariants |

Unsafe provider output is normalized/sanitized before capability input. All
mutations use current authority, exact Cell scope, fresh one-use permits and
atomic required Audit.

## Cross-capability relationships

- Formula, Workbooks/Data and Resolution satisfy `BoardContentProvider`; Boards
  owns binding semantics, normalized scene and last-good state.
- Files supplies exact images/media/renditions and receives exports. Object
  keys, presigned URLs and scanner internals never enter Board state.
- Knowledge calls `boards.extract.v1`. Authored content is eligible; bound or
  inferred display is labeled and excluded by default to prevent feedback.
- Collaboration uses Board-native stable anchors. Translation owns SVG/PDF/
  native package codecs. Agents execute ordinary commands or submit typed
  proposals.
- Board Template publication and instantiation use the seven family-owned
  `boards.templates.*.v1` operations defined by
  [Translation and Templates](translation-and-templates.md#family-templates).

## Headless proofs and examples

```text
create board "Signals" --mode dashboard -> structure r0
add metric M1, chart C1 and connector L1(M1 -> C1)
bind M1 to Formula result@v4 -> M1 r1
concurrently move M1 and restyle C1 -> both commit
remove M1 --policy reject_if_referenced -> board_broken_reference
remove M1 --policy detach -> M1 removed, L1 free endpoint in one commit
render --svg -> byte-stable scene and exact source revisions
```

Required proofs include:

- fixed-point geometry, graph acyclicity, endpoint, containment, layer/order and
  mode constraints with property/fuzz tests;
- deterministic align/distribute/group transform and JSON/SVG goldens;
- bounded element/subgraph duplication proves fresh-ID allocation, internal
  edge remap, external-edge policy, replay, concurrent source edit and no
  comment/private-state aliasing;
- concurrent independent/same-property, graph, structure and view operations
  against a live Project Database;
- explicit remove/cascade/detach and mode-conversion loss behavior;
- all seven Board Template preview/publish/get/list/plan/instantiate/lifecycle
  surfaces enforce
  stripping, exact version requirements, lineage and ordinary Board creation;
- stale binding/provider timeout preserves last-good values;
- malicious SVG/embed/asset fixtures are sanitized or rejected;
- idempotency, crash boundaries, permit revocation and effect/Audit atomicity;
- bounded render query proves zero Job/work/artifact/idempotency writes and
  exact async-required routing; durable render request/status proves frozen
  revisions, typed metadata, lease loss and stale-result fencing; and
- complete headless whiteboard/dashboard edit, bind, extract and export flows.

## Source grounding

- [SOL X 29 — Boards](https://app.notion.com/p/39ab6410e50281e894d5ebec8cd991c8)
- The original [Taurus Product Vision](https://app.notion.com/p/377b6410e50280c69389e5763939cbf0)
  defines one Board model with Whiteboard and Dashboard modes, shapes,
  connectors, embeds, data bindings, sources and export. It is vision evidence;
  no verified Board construction existed.
- Current Omega [experience](../product/experience-map.md),
  [capability](../architecture/capability-model.md) and
  [persistence](../architecture/persistence-and-concurrency.md) contracts set
  backend canonical truth, consumer-owned ports and family-specific revisions.

### Nova evidence (pinned)

- Nova provides useful evidence for Project-scoped Resources, durable workspace
  references and generated Product boundaries. The audited tree at
  [`3df790b2`](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova)
  contains no canonical Board engine, and its
  [`resource` registry](https://github.com/gccurtis/merkabah/tree/3df790b2ac736f644e577ae4e6f4e899e6e85b6d/taurus-nova/internal/resource)
  composes only a legacy Document family reference. Boards is a new Omega
  contract; no Nova UI or storage representation is compatibility authority.

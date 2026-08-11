# Design — document pagination and row-windowed editing

**Status: partially implemented (2026-07-23).** Alpha now has canonical point
geometry, deterministic page plans, real page sheets, visible-page overscan, the
normalized row repository, additive window clients, and Omega's current
revision-bound layout/save contract. Omega descriptor/manifest/window endpoints and
editable ProseMirror window eviction remain open behind the documented behavior gate.

## Decision

Pagination is a **front-end projection of ordered rows through canonical document
layout**. Alpha should request a document descriptor, a lightweight ordered row
manifest, and bounded row-content windows—not mutable page objects. It should then
compose rows into pages locally and fetch more row content as the viewport moves.

Three concerns must remain separate:

1. **Transport windowing** decides which row bodies cross the network.
2. **Pagination** decides which rows occupy each visual page.
3. **DOM windowing** decides which page and row elements are mounted.

That separation is important because ProseMirror does not supply virtualization.
Its maintainer states that it “doesn’t do viewporting” and normally puts the entire
document in the DOM. ProseMirror still remains the editing engine, but true
windowed editing must be a Taurus-owned adapter with explicit behavioral tests, not
an assumed library feature. See the
[ProseMirror guide](https://prosemirror.net/docs/guide/), the
[EditorView reference](https://prosemirror.net/docs/ref/#view.EditorView), and the
maintainer discussions on
[loading on scroll](https://discuss.prosemirror.net/t/improving-performance-loading-on-scroll/4972)
and
[virtual scrolling](https://discuss.prosemirror.net/t/virtual-scroll-for-prosemirror/8882).

The recommended rollout therefore ships correct pagination before it attempts to
evict editable DOM. The existing full-document editor remains the production
fallback until the windowed adapter is behaviorally indistinguishable for ordinary
editing.

## Product contract

Opening a document should eventually look like this:

```text
document descriptor
        │
        ├── layout, layout rules, revision, counts
        │
        └── row-manifest cursor
                    │
                    ▼
        lightweight ordered row metrics
                    │
                    ▼
          pure pagination engine ──────> complete PagePlan
                    │
                    ▼
           viewport + prefetch policy
                    │
                    ▼
          bounded row-content requests
                    │
                    ▼
       row cache + optimistic edit overlay
                    │
                    ▼
     page renderer + ProseMirror editor adapter
```

The user sees ordinary pages and ordinary editing. Page boundaries are derived and
may move when layout or preceding row heights change. The document remains an
ordered row resource; a page is never a durable content container or an API paging
unit.

## Goals

- Render distinct page sheets from the document's real size, margins, layout rules,
  row order, and row heights.
- Calculate page membership in Alpha with deterministic, testable pure functions.
- Load enough row bodies for approximately eight pages at a time, with configurable
  overscan.
- Fetch forward and backward without blank jumps and preserve the user's scroll
  anchor while estimates become exact.
- Keep row identity stable through fetch, edit, page reflow, save, and collaboration.
- Preserve normal typing, selection, copy/paste, undo/redo, IME composition, prompt
  blocks, inspector targeting, and script-driven runtime edits.
- Make full-document features such as search, outline, and counts truthful when only
  some row bodies are local.
- Allow the safe full-document editor and a future windowed editor to share the same
  row store and pagination engine.

## Non-goals

- Persisting pages or page numbers in Omega.
- Requesting “page 8” from the backend.
- Making CSS pixels canonical layout units.
- Splitting one canonical row across pages in the first policy.
- Treating an approximate DOM measurement as durable document state.
- Shipping a custom ProseMirror viewport implementation without a focused prototype
  and parity suite.
- Combining this work with the concurrently changing context or inspector panels.

## Baseline at design approval

Alpha called `GET /documents/:id`, received the resolved document with all
rows, converts all content into one `EditorState`, and mounts one `EditorView`.
`DocumentRuntime` is both the content owner and the sync loop. The stage paints one
continuous paper surface; a local helper derives a page count but does not compose
separate page sheets.

At that point Omega had more layout support than Alpha's data types acknowledged:

- `Base` contains `PageLayout`, `LayoutRules`, and ordered `Rows`.
- Geometry uses whole typographic points (1/72 inch).
- Canonical row height is
  `MaxFontHeight + 2 × MinRowPadding + Row.Style.HeightIncrease`.
- `Paginate(Base)` already provides a deterministic reference projection.
- Pages are explicitly derived, not persisted.
- Documents have an exact revision, and change submission is revision-bound and
  idempotent.

Omega still exposes the resolved full document through `GET /documents/:id`; it has
no descriptor, row-manifest, or row-window route. The Alpha document client was also
behind Omega's current layout, style, revision, and submission shapes. Contract
alignment was therefore a prerequisite, not pagination work to hide inside a view
component.

The implemented frontend now normalizes the current revision/layout/style contract,
derives exact pages from resolved rows, and renders viewported sheet backgrounds plus
presentation-only page breaks around the same continuous editor. It still uses the
resolved full-document read until Omega provides the bounded routes below.

Omega's server-side `Paginate` remains valuable as a reference implementation,
validation oracle, export primitive, and non-browser projection. It does not change
ownership of interactive page composition: Alpha needs local page plans immediately
for edits, layout previews, scrolling, and optimistic state.

## Shared vocabulary

- **Document descriptor** — bounded document metadata at one revision, excluding row
  bodies.
- **Row manifest** — ordered lightweight entries containing the identity and
  canonical height inputs needed to paginate every row.
- **Row window** — a bounded contiguous set of complete row bodies.
- **Page plan** — Alpha's derived ordered pages and their row membership.
- **Render window** — pages mounted around the viewport, including overscan.
- **Editing island** — one contiguous loaded range owned by one ProseMirror
  `EditorView`; it may span several pages and is never synonymous with a page.
- **Scroll anchor** — `{ rowId, offsetWithinRow }`, used to stabilize the viewport
  when content before it changes height.

## Canonical geometry and page composition

All pagination math operates in integer typographic points. Conversion to CSS pixels
happens only at the rendering boundary:

```text
usablePageHeight =
  pageHeight - marginTop - marginBottom

standardRowHeight =
  maxFontHeight + (2 × minRowPadding)

canonicalRowHeight(row) =
  standardRowHeight + row.heightIncrease
```

Rows are packed in manifest order. A row stays on the current page when it exactly
fits. If the next row would overflow a non-empty page, it starts the next page. An
empty document still has one empty page.

The initial policy does not split rows. Omega already constrains the maximum row
height so one valid row fits within usable page height. If future rich content needs
intrinsic height, headers/footers, wrapping rules, or row continuation, those inputs
must enter a versioned pagination policy rather than being inferred differently by
each browser.

The browser may measure DOM to detect a mismatch, but it must not silently use that
measurement as canonical pagination. A row whose content cannot fit its declared
height should surface an overflow state or propose a `set_row_height` change.

### Estimating the first content request

Eight pages is a policy default, not an API constant:

```text
estimatedRowsPerPage =
  max(1, floor(usablePageHeight / standardRowHeight))

requestedRows =
  clamp(
    estimatedRowsPerPage × targetPages + overscanRows,
    minimumRowWindow,
    maximumRowWindow
  )
```

The estimate intentionally uses the standard height because it is available from the
descriptor before row bodies arrive. Actual manifest heights drive page composition.
If loaded rows are taller, the same request may cover fewer than eight pages; the
viewport controller immediately requests another window when needed.

Target pages, overscan, and row caps belong in a front-end pagination policy object
so tests can use small values and product tuning does not alter document content.

### Exact page count

An exact front-end page count requires the ordered height input for every row. A
document-level `rowCount` plus one average height can only produce an estimate.

The design therefore separates the compact **manifest** from full row content.
Alpha streams all manifest entries—IDs, order, and height inputs—while loading full
blocks/atoms only for the render window. Once the manifest is complete, page count
and every page boundary are exact without downloading every row body.

Info should show a quiet calculating/skeleton state while the manifest is incomplete,
then an exact integer. It should not present an estimate as exact and should not add
“estimated” to a value that has completed manifest pagination.

## Proposed additive Omega contract

The first backend request should be additive so existing Alpha and other clients do
not break.

### Document descriptor

```http
GET /documents/:documentID/descriptor
```

```json
{
  "id": "doc-1",
  "projectId": "project-1",
  "name": "Research",
  "createdAt": "2026-07-23T10:00:00Z",
  "updatedAt": "2026-07-23T10:05:00Z",
  "revision": 42,
  "rowCount": 1280,
  "pageLayout": {
    "width": 612,
    "height": 792,
    "marginTop": 72,
    "marginRight": 72,
    "marginBottom": 72,
    "marginLeft": 72
  },
  "layoutRules": {
    "maxFontHeight": 24,
    "minRowPadding": 4,
    "maxHeightIncrease": 144
  },
  "rowSnapshot": "opaque-revision-bound-token"
}
```

The descriptor may also carry exact whole-document aggregates such as word and
character counts when Omega can maintain them cheaply. It must not resolve and
serialize all row bodies merely to omit them afterward.

### Row manifest

```http
GET /documents/:documentID/row-manifest?snapshot=...&cursor=...&limit=...
```

```json
{
  "documentId": "doc-1",
  "revision": 42,
  "rows": [
    { "id": "row-100", "ordinal": 100, "heightIncrease": 0 },
    { "id": "row-101", "ordinal": 101, "heightIncrease": 24 }
  ],
  "previousCursor": "opaque-or-null",
  "nextCursor": "opaque-or-null"
}
```

Manifest cursors are opaque and snapshot-bound. `ordinal` is a projection useful for
diagnostics and initial placement, not a mutation address; edits continue to use
stable IDs.

### Row content window

```http
GET /documents/:documentID/rows?snapshot=...&cursor=...&limit=...&direction=forward
```

```json
{
  "documentId": "doc-1",
  "revision": 42,
  "rows": [
    {
      "id": "row-100",
      "style": { "heightIncrease": 0 },
      "blocks": []
    }
  ],
  "startOrdinal": 100,
  "endOrdinal": 131,
  "previousCursor": "opaque-or-null",
  "nextCursor": "opaque-or-null"
}
```

The API also needs a bounded way to locate context around a stable row ID for search,
outline, comments, history, and collaborator anchors:

```http
GET /documents/:documentID/rows/locate?rowId=...&before=...&after=...
```

The exact route spelling can change during Omega review. The invariant is more
important: descriptor, manifest, and row bodies are separately bounded and refer to
one coherent revision.

### Snapshot consistency

Every cursor and row response must belong to the descriptor's revision. Fetching
window A at revision 42 and window B from a silently newer row order is not safe.

The preferred contract is an opaque, bounded-lifetime `rowSnapshot` token. If Omega
cannot retain a snapshot yet, the first implementation may require
`expectedRevision`; a changed head returns a structured conflict and Alpha refreshes
its descriptor/manifest. That fallback is acceptable for a first increment but can
starve under active collaboration, so it is not the final collaboration design.

### Migration

1. Add descriptor, manifest, and row-window routes while preserving the resolved
   `GET /documents/:id`.
2. Add Alpha clients and dual-path fixtures.
3. Move the runtime to the new contract behind one capability switch.
4. Remove the legacy full-document path only after all Alpha consumers and dev
   walkthroughs have migrated.

The reviewed requirement is tracked in
[backend-requests/document-row-windows.md](../backend-requests/document-row-windows.md).

## Front-end architecture

```text
src/lib/data/
  documents.ts             resolved-document normalization + revisioned writes
  document-rows.ts         additive descriptor/manifest/window/locate clients

src/lib/features/stages/document/pagination/
  geometry.ts              point-based validated layout math
  paginate.ts              pure manifest -> PagePlan projection
  pagination-policy.ts     target pages, overscan, request caps
  page-index.ts            row <-> page lookup
  row-repository.ts        normalized manifest/body cache and pin-aware eviction
  viewport.ts              visible-page range and overscan projection

src/lib/features/stages/document/editor/
  pagination-plugin.ts     row sizing + presentation-only page breaks

src/lib/features/stages/document/
  runtime.ts               page-plan/repository orchestration
  DocumentStage.svelte     visible sheet range + display conversion
```

Future transport and editing-island adapters should extend these boundaries rather
than move pagination back into the stage or API client.

Names are provisional, but dependency direction is not:

```text
wire clients -> row repository -> pagination engine -> viewport
                                      │                 │
                                      └──── runtime ─────┤
                                                        ▼
                                                editor adapter + stage
```

The pure paginator imports no Svelte, DOM, ProseMirror, network, or store code. The
row repository knows rows and revisions but not pages. The viewport consumes page
plans but cannot submit edits. `DocumentRuntime` remains the one view-independent
orchestrator for an open document.

### Core front-end types

```ts
type RowMetric = {
  id: string;
  ordinal: number;
  height: LayoutPoint;
};

type PagePlan = {
  number: number;
  rowIds: string[];
  firstOrdinal: number | null;
  lastOrdinal: number | null;
  usedHeight: LayoutPoint;
  usableHeight: LayoutPoint;
};

type RowCacheEntry =
  | { status: 'missing'; metric: RowMetric }
  | { status: 'loading'; metric: RowMetric; requestId: string }
  | { status: 'ready'; metric: RowMetric; row: Row }
  | { status: 'dirty'; metric: RowMetric; row: Row; baseRevision: number }
  | { status: 'error'; metric: RowMetric; message: string };
```

Use a branded integer `LayoutPoint` or an equivalent constructor-validated type so
CSS pixels and points cannot be passed to the same functions accidentally.

### Row repository responsibilities

- Normalize row bodies by stable ID and keep manifest order separately.
- Deduplicate overlapping manifest and content requests.
- Abort obsolete requests after a document closes or snapshot changes.
- Overlay optimistic local rows over server rows.
- Pin selected, composing, dirty, saving, and conflict rows.
- Evict only clean row bodies; manifest metrics remain available for page geometry.
- Expose explicit states rather than representing “not loaded” with an empty row.
- Reconcile accepted operations and invalidate order/metrics from the first affected
  row.
- Never let a late response from an old snapshot overwrite a newer cache.

An LRU may bound clean row bodies, but cache policy is not the same as page policy.
Eight target pages should not imply exactly eight cached pages.

### Page index and invalidation

The first implementation can linearly pack the manifest; its behavior is simple and
easy to verify. The API should nevertheless expose suffix invalidation:

- content-only edit with unchanged height: no repagination;
- one row-height change: repaginate from that row's current page;
- row insert/delete/move: repaginate from the earliest affected ordinal;
- page layout or layout-rule change: repaginate everything.

If profiling shows that very large manifests make suffix repacking expensive, the
same interface can adopt prefix sums or a balanced height index later. Complexity
should follow measured need.

## Rendering pages

Pages are presentation wrappers, not ProseMirror document nodes. Making derived page
nodes part of the editor schema would cause ordinary typing near a boundary to
rewrite structural content solely because presentation reflowed.

For the safe full-document adapter:

- keep one `EditorView`;
- expose explicit row boundaries (ultimately `doc -> row+`, rather than relying on
  flattened blocks);
- use a ProseMirror plugin/decorations to insert non-canonical visual breaks between
  rows selected by the page plan;
- render page sheets and gutters from the same plan;
- convert points to display scale once at the stage boundary.

One page must not equal one `EditorView`. That would fragment selection, clipboard,
composition, keyboard navigation, history, plugin state, and cross-page commands.

The current bridge flattens Omega rows into top-level ProseMirror blocks and repeats
`rowId` attributes. The implemented metric builder groups consecutive blocks by that
stable ID, so a multi-block horizontal row remains one pagination unit. A dedicated
ProseMirror `row` node may still simplify a future windowed editing island, but it is
not required for the safe full-document paginator.

## ProseMirror and true windowing

ProseMirror's public model is one `EditorState` containing the current document and
selection, displayed by one `EditorView`. The public view manages the editable DOM
for that document. Node views and decorations customize rendering, but they are not a
built-in viewport controller.

Two prototypes are plausible:

1. **Mounted node-view controller:** keep the complete ProseMirror document in memory
   and mount only nearby row DOM. This may reduce DOM cost, but not row-body network
   cost, and selection/DOM-position mapping across unmounted content is delicate.
2. **Editing island:** keep canonical rows in `RowRepository`; mount one contiguous
   loaded range in one `EditorView`, while other pages use inert row renderers or
   placeholders. This enables row transport windowing, but Taurus must preserve
   selection expansion, clipboard semantics, undo, composition, and window changes.

The editing-island direction best matches the desired transport model, but it is not
approved for production merely by this design. Both approaches must be prototyped
behind `EditorAdapter`; the full-document adapter stays available.

The windowed adapter may move or resize an island only when:

- no IME composition is active;
- pending changes in rows being removed have been durably accepted or retained in a
  pinned optimistic overlay;
- the current selection is not being discarded;
- the new range is contiguous and fully loaded;
- the scroll anchor can be restored after remount.

Dragging a selection, moving the caret, or invoking a command at an island boundary
must prefetch and expand the island before the interaction crosses it. If that cannot
be made reliable, Alpha should keep the full-document editor and limit v1 to network
prefetch plus visual page virtualization.

## Scroll and fetch lifecycle

### Open

1. Load descriptor and establish revision/snapshot.
2. Start manifest streaming.
3. Estimate rows for the target eight pages from the descriptor.
4. Request the first content window immediately; do not wait for the complete
   manifest.
5. Paginate each manifest increment and publish stable page shells.
6. Mount the safe editor adapter when its required content is ready.

### Scroll

1. `IntersectionObserver` reports the leading/trailing page sentinels.
2. The viewport controller calculates the render window plus overscan.
3. Missing row bodies for those pages become one or more deduplicated contiguous
   requests.
4. Existing page shells retain their height while content is loading.
5. `ResizeObserver` is diagnostic for canonical-height mismatches, not an alternative
   paginator.

### Anchor stability

Scroll position is anchored to a row ID and an offset within that row, never to a
page number. When inserted rows or corrected metrics move content before the anchor,
the viewport controller adjusts scroll position so the anchored content stays under
the user's eye. Page numbers are allowed to change.

### Jump

Search, outline, comments, and history return a stable row target. `rows/locate`
provides the bounded context and cursor needed to load it. Alpha composes the target's
page, scrolls to the row anchor, then focuses the exact block/atom after the relevant
editing island is ready.

## Editing and revision behavior

- The row repository is the local content source of truth; ProseMirror is an editing
  projection, not the only copy of a partially loaded document.
- Every local edit becomes ID-addressed Omega operations against an exact revision.
- Dirty rows are pinned and remain visible through pagination changes.
- An accepted change updates revision, optimistic rows, manifest order/height, and
  page invalidation as one runtime transition.
- A stale-revision conflict pauses new window eviction, preserves the user's local
  operations, refreshes the descriptor/affected rows, and enters the existing
  conflict/reapply flow.
- Remote row insertion/deletion/movement invalidates manifest order from the earliest
  affected ordinal. Remote content-only changes refresh only affected cached rows.
- Page changes never generate content operations. Only a user's layout or row-height
  edit does.

ProseMirror's built-in history cannot be treated as global history once editable
content can leave an editing island. Before windowed editing ships, the runtime needs
a document-level local transaction journal or an equally explicit bridge to Omega's
change-set undo/redo. Discarding an `EditorState` must not discard the user's ability
to undo an accepted edit.

## Whole-document projections with partial content

Features that currently scan `EditorState.doc` become incomplete under row windowing.
They need explicit sources:

| Feature | Source under row windowing |
| --- | --- |
| Page count | Complete row manifest + Alpha paginator |
| Word/character count | Exact descriptor aggregates maintained by Omega |
| Search/replace | Omega whole-document search results; load row context before edit |
| Outline | Omega heading projection or manifest-level heading summaries |
| Comments/history targets | Stable row/block anchors + `rows/locate` |
| Export/print | Exact-revision Omega projection or explicitly load a complete snapshot |
| “Select all” / whole-doc copy | Dedicated full-snapshot behavior, not loaded rows only |

Alpha must never silently label a loaded-window search as whole-document search.
Replace-all should be a revision-bound backend operation or proposal, not a loop over
whatever rows happen to be cached.

## Failure and edge behavior

- **Descriptor fails:** show the existing document error state; do not create a local
  phantom document.
- **Manifest page fails:** retain known page shells and offer retry at the unresolved
  boundary.
- **Row body fails:** show an inline retry state with the canonical row height so
  scrolling does not collapse.
- **Snapshot expires:** retain dirty overlays, obtain a new descriptor/manifest, and
  reconcile by stable ID.
- **Row deleted while dirty:** enter an explicit conflict; never recreate it
  implicitly.
- **Layout changes mid-scroll:** repaginate, then restore the row scroll anchor.
- **Empty document:** one editable empty page and a server-created or locally
  inserted first row according to the existing creation contract.
- **Oversized/invalid row metric:** reject it at the data boundary and surface a
  contract error; do not let `NaN`, negative height, or an infinite loop reach the
  viewport.
- **Offline after load:** cached rows remain readable; edits follow the existing
  pending/error policy and unloaded rows show an offline boundary rather than
  fabricated content.

## Implementation sequence

Phases 0 and 1 are complete. The page-sheet portion of Phase 3 is also active; its
random-jump and scroll-anchor work remains gated with Phase 2 transport. Phases 2,
4, and 5 remain open.

### Phase 0 — contract alignment and fixtures

- Update Alpha's document wire types for Omega's current revision, layout, styles,
  and idempotent submission contract.
- Capture representative multi-page, mixed-height, multi-block-row fixtures.
- Extract and review the additive Omega backend request.
- Add a capability flag so the legacy full-document route remains usable.

### Phase 1 — pure pagination with the current full document

- Introduce point-based geometry, row metrics, paginator, page index, and policy.
- Cross-check Alpha page plans against Omega `Paginate` fixtures.
- Render actual page sheets/breaks through the safe full-document adapter.
- Replace the temporary pixel/string page-count helper.
- Keep all existing editing and sync behavior.

This gives immediate product value and validates pagination independently of
windowing.

### Phase 2 — descriptor, manifest, and row repository

- Implement Omega's additive endpoints and snapshot semantics.
- Add Alpha clients, repository, request dedupe, optimistic overlay, and diagnostics.
- Stream the manifest for exact global pagination.
- Fetch the first estimated eight-page content window and prefetch on scroll.
- Initially allow the full-document adapter to accumulate content without eviction;
  measure network, time-to-first-page, DOM growth, and memory.

### Phase 3 — visual page virtualization

- Mount page sheets only for the render window and preserve offscreen height with
  page placeholders.
- Keep the safe ProseMirror view behavior unchanged unless page-shell virtualization
  proves it can coexist cleanly.
- Add scroll-anchor restoration and random-jump coverage.

### Phase 4 — windowed editor prototype

- Implement both candidate approaches behind `EditorAdapter`.
- Run the parity and stress suites below.
- Select the approach using measured behavior and maintenance cost.
- Ship only if all user-functionality gates pass; otherwise retain the full-document
  adapter and continue bounded fetch/prefetch improvements.

### Phase 5 — production hardening

- Add whole-document backend projections required by search, outline, counts, and
  export.
- Enable cache eviction for clean row bodies.
- Add collaboration churn, offline, snapshot expiry, and long-document telemetry.
- Remove the legacy full-document path only after a measured soak period.
- Graduate implemented behavior into `docs/architecture/` and mark this plan
  complete.

## Verification

### Pure paginator

- empty, one-row, exact-fit, one-point overflow, mixed-height, and maximum-height
  rows;
- margins/orientation/layout changes;
- insert/delete/move/height-change suffix invalidation;
- Alpha results match Omega reference fixtures byte-for-byte by page number, row IDs,
  and used height.

### Repository and transport

- overlapping request dedupe and abort;
- forward/backward cursors and random locate;
- snapshot mismatch/expiry;
- late old-snapshot response rejection;
- dirty-row pinning and clean LRU eviction;
- optimistic insert/delete/move and conflict recovery.

### Editing parity gate

- typing and IME at the first/last row of a loaded range;
- arrow, page, home/end, and mouse navigation across page/window boundaries;
- shift-selection and drag-selection across boundaries;
- copy, cut, paste, drag/drop, select-all, and replace;
- undo/redo before and after an island moves;
- prompt blocks and multi-block horizontal rows;
- inspector selection, comments, outline/search jumps, and collaborator anchors;
- tab switch/unmount/remount with pending saves;
- layout edit while caret and scroll anchor are below the changed boundary.

### Performance budgets

Budgets should be recorded before Phase 2 is considered complete:

- descriptor-to-first-page latency;
- maximum concurrent row requests;
- mounted page, row, and DOM-node counts;
- row-body cache bytes and eviction count;
- pagination and suffix-repagination duration;
- scroll-anchor correction magnitude;
- long-task and dropped-frame rate during fast scroll;
- edit-to-saved latency under prefetch.

No fixed numerical target is invented in this design; baselines should be measured on
the agreed representative documents and then turned into regression thresholds.

## Review decisions

This proposal makes the following calls:

1. **Yes:** Alpha owns interactive row-to-page composition.
2. **Yes:** Omega serves descriptors, row metrics, and row bodies; it may retain a
   deterministic page projection as a reference/export primitive.
3. **Yes:** request size is estimated from standard row height and a target of roughly
   eight pages, then corrected using actual row metrics.
4. **Yes:** exact global page count comes from a compact complete manifest, not all
   row bodies and not an average.
5. **No:** page is not a backend fetch unit or a ProseMirror schema node.
6. **No:** one page does not get one editor instance.
7. **No:** ProseMirror is not assumed to provide virtualization.
8. **Gate:** row-content eviction from the editable surface ships only after editing
   parity is demonstrated.

The main remaining product decision is whether a temporary full-document fallback is
acceptable for documents that exceed the proven windowed-editor envelope. This plan
recommends that fallback because correctness of editing is more important than
claiming virtualization prematurely.

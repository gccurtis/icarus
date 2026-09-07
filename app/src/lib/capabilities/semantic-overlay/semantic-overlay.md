# Semantic Overlay

The project-scoped bridge from authoritative resources to two explicit search
lanes: exact text and interpreted semantic material.

- Accepted document and slide-deck mutations call `enqueueSemanticSync`, which
  coalesces exact work in `semanticSyncJobs` and material work in
  `semanticMaterialJobs` without reading resource bodies or native bytes.
- `projectResource` walks a leader once and emits canonical UTF-16 text plus
  locator spans and first-class table/chart/image material seeds. Prompt blocks
  are excluded from both outputs.
- `readSemanticResourceForModel` also resolves hash-pinned UTF-8 external text.
- `processSemanticSyncQueue` claims bounded exact and material batches.
  `syncSemanticResource`
  runs token-field embedding, deterministic segmentation, contextual passage
  embedding, a latest-revision check, and guarded publication.
- `publishSemanticTranslation` stages the full successor index before retiring
  the previous source objects and snapshots retired evidence by value.
- `syncSemanticMaterialsFor` profiles, optionally describes, separately embeds,
  revision/hash-checks, and publishes tables, CSV, charts, images, code, and
  spreadsheets. Native image vectors use Jina v4's shared vector space.
- `backfillSemanticOverlay` enumerates document/deck/spreadsheet leaders and
  external files and joins the same queue/worker paths used by normal authoring.
- A Derived Output refresh is itself a server pull boundary: its coalesced
  worker drains these queues before checking whether the current answer can be
  returned without provider work.

- `rebuildSemanticIndex` and `stageSemanticIndex` deterministically cluster each
  lane independently, write a replacement tree, publish its roots, and only
  then retire the old tree.
- `querySemanticOverlay` embeds one query with Jina's `retrieval.query` task,
  applies the optional resource set, traverses centroids best-first, scores the
  candidate objects exactly, coalesces overlapping source spans, and attaches
  intersecting resource locators before applying `topK`. Only current source
  objects are eligible, but older rows remain resolvable until tree replacement.
- `querySemanticMaterials` searches only current material facets, applies the
  same Resource Set policy, overfetches facets, groups by material, and returns
  distinct interpreted hits with attempt-local native-read handles. Shared
  asset identity/profile/native-visual facets remain eligible through any
  in-set source or placement; aggregate authored/generated facets persist every
  contributor in `scopeRefs` and require all contributors in-set. Context
  changes reuse unchanged facet vectors independently by input hash.

Derived Output's `read_*` tools do not query either lane. They resolve current
authoritative resource content and issue typed exact, structured, code, or
visual evidence. Orientation tools issue no evidence IDs.

No public procedure accepts a project ID. The request scope provides the project,
and every joined table is filtered to it before use.

The current JSON store has no cross-table transaction, so leader and outbox
writes are adjacent rather than atomic. The queues are durable, but an always-on
worker host/recovery loop and object-store upload adapter remain deployment
infrastructure. See `docs/semantic-overlay.md` and
`docs/semantic-material-layer.md` for the complete contract and bounds.

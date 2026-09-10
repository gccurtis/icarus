# Semantic Overlay

The project-scoped bridge from authoritative resources to two explicit search
lanes: exact text and interpreted semantic material.

- Accepted document and slide-deck mutations, material spreadsheet mutations,
  project-resource creation and template instantiation stage their authored rows
  and `enqueueSemanticOutboxFor` in the same Store transaction. The outbox
  coalesces exact work in `semanticSyncJobs` and material work in
  `semanticMaterialJobs` without invoking a provider inside that transaction.
- `projectResource` walks a leader once and emits canonical UTF-16 text plus
  locator spans and first-class table/chart/image material seeds. Prompt blocks
  are excluded from both outputs.
- `readSemanticResourceForModel` also resolves hash-pinned UTF-8 external text.
- `processSemanticSyncQueue` atomically claims bounded exact and material
  batches with random owner tokens and five-minute leases. Only the owner may
  settle a claim; expired work is recoverable, failures stop after three
  attempts, and a newer requested revision requeues terminal or obsolete work.
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
  returned without provider work. It also compares a semantic-input watermark
  around synthesis, so a collaborator's accepted revision cannot be missed
  merely because its overlay job landed mid-run.

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

The current Store unit of work makes each multi-table authored mutation and its
outbox intent atomic and journal-recoverable. Provider work stays outside that
boundary. An always-on worker host and object-store upload adapter remain
deployment infrastructure. See `docs/semantic-overlay.md` and
`docs/semantic-material-layer.md` for the complete contract and bounds.

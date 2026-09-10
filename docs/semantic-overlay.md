# Semantic Overlay

Status: implemented two-lane architecture, 2026-09-07.

The Semantic Overlay is the project-scoped bridge from authoritative resources
to semantic discovery. It has two independent index lanes:

- `text`: exact authored UTF-16 spans, queried by `retrieve`;
- `material`: separately provenanced facets for tables, CSV data, charts,
  images, code, and spreadsheets, queried by `retrieve_materials`.

The material lane is documented in detail in
`docs/semantic-material-layer.md`. This page records the common lifecycle and
the exact-text contract that Derived Output depends on.

## Invariants

1. A source never crosses a project boundary.
2. An editable source is pinned to a leader revision; External text is pinned
   to its required row revision and content hash.
3. Translation consumes a canonical string, never editor JSON.
4. Stored spans use absolute coordinates in that source and retain encoding.
5. A synthetic structural label is never inserted merely to aid retrieval.
6. Prompt Block output never re-enters either semantic lane.
7. Text and material trees have separate roots even though they share an
   embedding space.
8. Work must re-read current authority before publication; late work loses.
9. Stale objects remain resolvable until a successor tree is committed but are
   ineligible for search.
10. A citation is stored by value; active object IDs are not durable evidence.
11. Deduplicating a shared material never widens scope: aggregate contextual
    facets carry every contributor ref and require all contributors in-set.

## Source projection

`projectResource` performs one authoritative document/deck walk and returns:

```ts
type ProjectSemanticProjection = {
  exact: SemanticResourceProjection;
  materials: MaterialSeed[];
};

type SemanticResourceProjection = {
  ref: ResourceRef;
  revision: number;
  contentHash?: string;
  encoding: "utf-16";
  text: string;
  locators: SemanticLocatorSpan[];
  hardBoundaries: number[];
};
```

Documents traverse header, first-page header, body, footer, and first-page
footer in deterministic block order. Slide decks traverse visible slides,
frame-ordered elements/groups, and notes. A slide boundary is recorded as an
out-of-band coordinate and is never embedded as `Slide 1` text.

The exact lane contains narrative text, formulas' authored display values,
image alt/caption text, and authored table header rows. Native table bodies,
charts, image pixels, and spreadsheets use the material lane. Prompt Blocks are
excluded everywhere.

All callers use `projectResource(input)` directly; traversal lives under
`representation/data/behavior/semantic/projection/`, and exact-text consumers
read its `exact` projection.

### External exact text

`readSemanticResourceForModel` supports the current
`externalFile::text` source kind. It reads verified bytes through
`ExternalFileStorageModel`, requires valid UTF-8, rejects content over 5 MB,
and stores the External revision and file hash in the source snapshot.
Programming source is a distinct `externalFile::code` material and never enters
this exact lane; CSV/image/data files also remain outside exact retrieval.

## Entry points

The normal path begins only after a document/deck leader write is accepted:

```text
submitDocumentChanges / submitSlideDeckChanges / createProjectResource
  → enqueueSemanticSync({ ref })
      → enqueueSemanticSyncFor(ref, revision)       exact when supported
      → enqueueMaterialSyncFor(ref, revision)       material inventory
```

The public procedure derives project scope from the request and resolves the
current stored External subkind. Enqueueing is revision-only: it does not walk the body,
read native bytes, or call a provider.

`backfillSemanticOverlay` is the development/maintenance path. It enumerates all
document, deck, and spreadsheet leaders plus external files, enqueues the same
job shapes, and drains one bounded batch. It is safe to call repeatedly because
jobs coalesce and synchronization is idempotent unless `force` is requested.

## Exact translation

`syncSemanticResourceFor` performs the full exact flow:

1. read the current canonical projection;
2. return `current` when source identity, revision/hash, text, boundaries,
   locators, index, and embedding space already match;
3. request a contextual token field with `EmbeddingModel.tokenField`;
4. align provider labels exactly to source coordinates;
5. run deterministic distance-discounted-attraction segmentation;
6. reject a segment that crosses a hard boundary;
7. embed finalized source-local spans together through
   `EmbeddingModel.windowedPassages` with late chunking;
8. re-read the authoritative projection after provider work;
9. return `superseded` if revision, hash, text, boundaries, or locators changed;
10. stage a complete successor text index, publish source/objects/history, then
    commit the new roots and overlay generation.

Text is never silently truncated. The current full-source token operation fails
when provider context is exceeded. Provider-token-aware source-window planning
is deferred and must preserve global coordinates and complete coverage.

## Embedding operations

The model boundary exposes distinct operations rather than a distant boolean:

- `tokenField(text)`: contextual token multivectors for semantic translation;
- `windowedPassages(texts)`: source-local late-chunked passage vectors;
- `passage(text)`: one independent complete-passage vector;
- `passages(texts)`: independent vectors for material text facets;
- `image(input)`: one native image vector in the same passage space;
- `query(text)`: asymmetric query vector.

Every active index records provider, model, and dimensions. A query fails
closed when the configured embedding space differs from the active overlay.

## Recursive indexes

Each lane owns a divisive hierarchical spherical k-means forest:

1. normalize object vectors;
2. partition roots;
3. recursively partition only groups larger than `leafSize`;
4. derive every centroid from all original descendant vectors;
5. stop each branch independently.

`stageSemanticIndex` writes a complete candidate tree while the previous tree
remains queryable. Its caller either commits, removing the predecessor, or
rolls back all staged rows. An empty lane still has a valid empty index record.

Query traversal places all roots on one max-priority frontier. It expands the
best centroid first, evaluates exact cosine similarity at reached leaves, and
uses `candidateMultiplier` as an approximate-recall cushion. Eligibility is
passed into traversal before candidates are chosen; it is not a post-filter on
a mixed tree.

The frontier is not yet memory-bounded, and publication rebuilds the whole lane
tree. A delta tier/compaction strategy is future scale work.

## Exact query and span consolidation

`querySemanticOverlay`:

1. validates text, `topK`, and optional `ResourceSet`;
2. resolves current source snapshots by leader revision or external hash;
3. selects only text-lane objects owned by those snapshots and allowed by the
   set;
4. embeds the query;
5. traverses the active text tree;
6. scores candidates exactly;
7. unions overlapping or exactly adjacent spans from the same source snapshot
   and hard-boundary partition;
8. attaches intersecting locator spans;
9. applies final `topK` and returns diagnostics/usage.

Consolidation happens again after an agent selects evidence IDs across multiple
tool calls. That second pass joins repeated/overlapping selections while
retaining every ID and model-authored `use` annotation. Spans never merge across
resource, revision, content hash, encoding, partition, or overlay generation.

## Material query

`querySemanticMaterials` uses the active material tree, current material and
placement checks, optional kind filter, and the same Resource Set evaluator.
It overfetches up to five facets per requested hit, groups by material, and
returns distinct current materials with matched-facet provenance.

For a shared material, safe identity/profile/native-visual facets may remain
eligible through any in-scope source or placement. Aggregate `authored` and
`generated` facets are eligible only when every persisted `scopeRefs`
contributor is inside the explicit Resource Set. Contextual rows from before
that provenance field fail closed for scoped searches until backfill republishes
them. This prevents deduplication from leaking a caption, note, or neighboring
passage from another resource.

It never returns exact text objects. `querySemanticOverlay` never returns
material objects. The two query contracts are intentionally separate.

## Derived Output evidence contract

`synthesize` creates an attempt-local registry. The model receives sixteen
bounded tools:

- `retrieve` and `retrieve_materials` query the two overlay lanes;
- `read_selection` and `read_*` open authoritative resources and issue evidence
  IDs;
- `find_resources`, `list_*`, `inspect_*`, and `view_slide` orient without
  issuing evidence.

The structured result is:

```ts
type SynthesisDecision = {
  status: "answered" | "insufficient";
  response: string;
  evidence: { evidenceId: string; use: string }[];
};
```

For `answered`, at least one unique, issued ID is required. For `insufficient`,
application code discards provider prose and publishes a fixed coded response.
The application resolves IDs, rechecks sources/materials, and stores exact,
structured, visual, code, or descriptor citations by value.

When a user selection exists, `read_selection` is forced as the first tool.
Otherwise `retrieve` is forced first. Selection content is not spliced into the
stable system prompt.

## Derived Output freshness

Freshness is computed on pull and immediately before write:

- exact citations watch their selected revision or external content hash;
- native/descriptor citations watch material revision/profile/context plus any
  selected placement revision;
- an unrelated source change does not stale an answer;
- a citation-free negative result watches the overlay generation it searched;
- a user-edited response clears grounding metadata and becomes ungrounded
  continuity for the next refresh;
- a fresh response with unchanged evidence makes refresh a zero-provider-call
  `current` no-op;
- source churn retries with a new registry up to the configured bound;
- provider or repeated churn failure preserves the last good response.

## Prompt Blocks

Documents expose Derived Output through a normal editable Prompt Block:

1. convert an empty line with the ordinary Block selector;
2. configure the prompt and its scope in the Prompt inspector;
3. create/link the Derived Output;
4. signal refresh by Derived Output ID;
5. let the coalesced server worker drain pending semantic work and refresh;
6. copy response text into the block while preserving editor-owned mark ranges;
7. reopen settings through the star in the pasteboard gutter;
8. follow source titles in the evidence list back to resources.

The Prompts context rail only indexes existing blocks. It does not create them.
Prompt text/output stays text-only; marks and presentation never enter the
semantic or Derived Output capability.

## Persistence and deployment boundary

The JSON store has durable source/object/index/history rows, separate exact and
material job tables, and a coalesced `derivedOutputRefreshJobs` table keyed by
Derived Output. Every accepted authored mutation and its semantic outbox row
commit in one journal-recoverable Store transaction. Queue workers claim one
job immediately before execution, renew its five-minute lease during provider
work, recheck ownership inside publication and settlement transactions, and
stop after three failed attempts. Concurrent browsers join one server flight.
Repeating the same request is a pure join; only a changed definition revision
or selection advances the durable request version. The worker also compares
semantic-input watermarks around synthesis and retries when authoritative
revisions, pending semantic work, material revisions, or the overlay generation
actually move. Refresh job state is projected separately from value freshness,
so the last published value stays readable while replacement work runs. This
repository still has no always-on worker host; production deployment must
schedule the existing durable processors continuously.

## Primary code map

```text
representation/data/behavior/semantic/
  projection/ · translation.ts · recursive-index.ts · query.ts · citation.ts

capabilities/semantic-overlay/api/
  enqueue-semantic-sync/ · process-semantic-sync-queue/
  query-semantic-overlay/ · query-semantic-materials/
  shared/{sync,publication,index-publication,freshness,material-*}.ts

capabilities/derived-output/api/shared/
  agent-instructions.ts · synthesis.ts · resource-reading.ts · refresh-queue.ts · rows.ts
```

The visual procedure flow is served at
`/demo/semantic-overlay/derived-output-flow`. The agent runtime, resource tools,
material layer, and executable proof are neighboring pages under the same demo
route family.

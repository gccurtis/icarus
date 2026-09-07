# Semantic Overlay working notes

Status: implemented contracts and explicit follow-up work, 2026-09-04.

The executable code remains authoritative. This document distinguishes current
behavior from accepted target behavior so that an unfinished item is not read as
already implemented.

## Source boundary

A Semantic Overlay is project-scoped. Embedding context never crosses from one
semantic source into another.

A source is identified by its resource reference, revision, and text encoding.
The translation operation may receive its content in one of two runtime forms:

- complete text already resident in memory;
- a reader that yields source-local text windows for content that should not be
  materialized all at once.

The reader is runtime input. It is not part of the stored semantic source or
semantic object contract. Every produced span still uses absolute coordinates
in the original source and carries the source encoding.

## Embedding modes

Three separate modes are required. Their names should remain explicit at the
embedding-model boundary rather than being selected through an ambiguous
boolean at distant call sites.

### Windowed semantic translation

This is the normal text path and its provider/algorithm primitives exist now:

1. Give one complete source, or one source-local context window, to Jina v4 as
   a contextual token multivector field.
2. Align returned token labels to exact source coordinates.
3. Apply distance-discounted-attraction segmentation without another provider
   call.
4. Slice the selected spans exactly from that same source.
5. Send those span texts together with `retrieval.passage` and
   `late_chunking: true`.
6. Store one dense vector and exact source span per semantic object.

Late chunking applies only within the current source or source window. Segments
from different sources must never share one late-chunking request.

Current limitation: `truncate: false` deliberately fails when a source exceeds
the provider context limit. `syncSemanticResource` now orchestrates and persists
the complete flow for document and slide-deck projections; source-local window
planning remains required for inputs beyond the provider context.

### Complete passage embedding

Some sources should become one vector without segmentation or windowing:

```text
input = [complete source text]
task = retrieval.passage
late_chunking = false
result = one dense vector
```

The public embedding port now exposes `passage(text)`, which returns one vector,
and names the contextual operation `windowedPassages(spans)`. A complete-source
translation caller can use the former to produce one semantic object whose span
covers that source. That translation/persistence orchestration is still future
work.

### Query embedding

Queries remain a distinct asymmetric operation:

```text
input = [query text]
task = retrieval.query
late_chunking = false
result = one dense vector
```

Query embedding must use the same provider, model, and dimensions as stored
semantic objects.

## Very large sources

Add source-local window planning when large inputs need support. This is not a
request to combine or continuously rechunk the project corpus.

The planner must:

- measure the provider's token context rather than infer capacity from code
  units;
- create overlapping context windows within one source;
- support both an in-memory string and a reader;
- retain a global coordinate base for every window;
- assign an ownership/core region so overlapping windows do not publish the
  same source span twice;
- run token alignment and segmentation inside each context window;
- translate local boundaries back to absolute source coordinates;
- late-chunk only the finalized spans belonging to that source window;
- fail rather than silently truncate or lose uncovered source text.

Open design work: choose overlap size, reconcile a semantic segment crossing a
window ownership boundary, expose model context limits through configuration,
and define retry/checkpoint behavior for a reader that fails partway through.

## Recursive index

### Current construction

The index is divisive hierarchical spherical k-means:

1. Normalize every semantic-object vector.
2. Partition the complete corpus into a forest of roots.
3. Compute every node centroid from all original object vectors below that
   node, not by equally averaging child centroids.
4. Re-run spherical k-means only inside a partition that exceeds `leafSize`.
5. Stop each partition independently once it fits in a leaf.

Every object belongs to exactly one child at a partition. This is a neighborhood
hierarchy, not an onion around one center: roots choose the broad neighborhood
(the suburb), child nodes repartition only that neighborhood (the block), and
leaves hold its local objects (the houses). A small outlier neighborhood can
remain a leaf while a larger neighborhood continues to split. Every node's
normalized centroid summarizes all original descendant vectors; its ancestry
records nested membership, while centroid similarity remains a routing score
rather than a formal upper bound on every descendant.

### Current query

All roots enter one max-priority frontier. The highest query-to-centroid score
is popped next:

- an internal node adds all child nodes back to the frontier;
- a leaf adds its eligible semantic objects to the candidate set;
- lower-scoring branches remain in the frontier for possible later expansion;
- after oversampling, candidate objects receive exact cosine scores;
- overlapping spans coalesce before final top-k selection.

`candidateMultiplier` is primarily an approximate-recall cushion. It also
ensures coalescence is less likely to leave fewer than top-k distinct hits; if
coalescence still does so, the search expands its candidate target again.

The frontier is not currently memory-bounded. Future work may add a deterministic
beam or `maxFrontierNodes` limit, but eviction must be visible in diagnostics
because discarding a low-scoring centroid can discard a high-scoring descendant.

## Derived Output evidence contract

### Implemented contract

Remove the separate opaque-handle `read` step. Retrieval should return the
similar source content immediately, while application code assigns every
returned hit an attempt-local evidence ID:

```ts
type RetrievedEvidence = {
  evidenceId: string;
  source: SemanticSourceSnapshot;
  span: SemanticSpan;
  locators?: SemanticLocatorSpan[];
  score: number;
  overlayGeneration: number;
};
```

The registry behind each ID remains application-owned. The model may issue
several retrievals and then returns a strict structured decision that selects
only evidence IDs it actually used:

```ts
type SynthesisDecision = {
  status: "answered" | "insufficient";
  response: string;
  evidence: { evidenceId: string; use: string }[];
};
```

The `use` value explains the evidence's role; it is model-authored
annotation, not provenance. The application should not require the model to
invent exact quote offsets inside a retrieved span. When the source projection
has structural locators, retrieval carries the overlapping locator spans and
the selected citation copies them by value for later editor highlighting.

Before publication, application code must verify that:

- every selected ID was issued during this attempt;
- an answered result selects at least one evidence item;
- selected hits resolve to valid stored-by-value citations;
- selected citations still match the active source revision and encoding;
- the Derived Output definition was not superseded during synthesis.

Only selected evidence needs source-revision preflight. If selected evidence
changed during synthesis, discard the attempt and retry within the configured
bound. An insufficient result or an answered result with blank, duplicate, or
unissued evidence must not publish unsupported prose. The application instead
publishes its fixed, explicit insufficient-evidence response. Malformed provider
JSON is a bounded synthesis failure and also never publishes provider prose.

## Derived Output lifecycle

Keep the Semantic Overlay and Derived Output lifecycles independent:

- overlay source changes translate and advance overlay generation;
- reading a Derived Output computes freshness from its cited source revisions;
- an unrelated overlay generation change does not stale the response;
- an insufficient-evidence response has no citations, so it becomes stale when
  the overlay advances beyond the generation it searched;
- refresh validates only selected cited sources before publication;
- provider failure or repeated source churn preserves the last good response;
- a scheduled interval may perform the same pull-based freshness read later;
  source updates should not fan out writes over all Derived Outputs.

The public update operation accepts a user edit to `lastResponse`. The edit is
normalized to the current single-paragraph content shape, advances
`lastRevision`, clears evidence and generation metadata that cannot safely be
claimed for edited prose, and marks the row stale. On refresh it becomes the
continuity example supplied to the agent so wording and organization can remain
stable. It is context, never factual evidence.

Templated Derived Outputs are also implemented. A definition contains named
variable prompts, an output template, and an optional style-only example. The
provider returns a structured array of variable values and evidence selections;
the application validates exact names and grounding, stores the resolutions,
and renders the final text itself.

Documents now expose that lifecycle through a simple Prompt Block. An empty line
converts through the ordinary Block selector, then the Prompt inspector creates
and links the Derived Output, processes up to 50 pending semantic-sync jobs, and
refreshes it in the same user request. The published answer is synchronized into
the block's normal editable text, so it remains selectable, formattable, and
editable; the document editor preserves its own absolute mark ranges and the
Derived Output remains text-only. A small star in the pasteboard gutter reopens
settings. An inline edit becomes exact ungrounded continuity on the next refresh.
The Prompts rail is only an index of blocks in the current document. Queued
Derived Output execution and non-document placement adapters remain separate
scale-up work.

## Resource publication

Document and slide-deck leader snapshots now project through one canonical
UTF-16 text seam. The projection stores locator spans back to titles, document
blocks, slide elements, groups, tables, captions, and speaker notes. Hidden
slides and prompt blocks are excluded.

Accepted resource changes coalesce by resource and requested revision in
`semanticSyncJobs`. The bounded worker embeds the latest projection, checks that
the revision/text remain current after provider calls, stages a complete
replacement recursive index, archives retired object values, and advances the
overlay generation without an asynchronous publication gap.

The current JSON store cannot transact a resource leader and queue row across
files, and this repository has no always-on worker host. Those are deployment
infrastructure gaps rather than missing procedure contracts.

## Follow-up sequence

1. Add a transactional resource-write/outbox boundary and always-on worker host.
2. Add source-local large-text and reader window planning.
3. Add bounded `read_selection`, `find_resources`, and authoritative `read`
   evidence tools. Only `retrieve` queries the Semantic Overlay; selection and
   read go directly to project resources.
4. Add an optional bounded query frontier with truncation diagnostics and recall
   tests.

The development-reference method and the visual/executable proof for this flow
are documented in `docs/development-reference-surfaces.md`.

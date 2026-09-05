# Semantic Overlay working notes

Status: architectural review decisions and follow-up work, 2026-09-04.

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
the provider context limit. The adapter and pure translation stages exist, but
the source-update capability that orchestrates and persists the complete flow
is not wired yet.

### Complete passage embedding

Some sources should become one vector without segmentation or windowing:

```text
input = [complete source text]
task = retrieval.passage
late_chunking = false
result = one dense vector
```

The current private dense request can perform this operation, but the public
embedding port has no explicit whole-passage method. Add a method such as
`passage(text)` and make the existing contextual operation explicit, for
example `windowedPassages(spans)`. A complete source produces one semantic
object whose span covers that source.

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

Every object belongs to exactly one child at a partition. A small outlier group
can remain a leaf while a larger nearby group continues to split. The hierarchy
therefore records successive cosine-space partitions, but it is not a metric
tree: centroid similarity is not an upper bound on every descendant and depth
does not encode a formal linkage distance.

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

### Accepted target

Remove the separate opaque-handle `read` step. Retrieval should return the
similar source content immediately, while application code assigns every
returned hit an attempt-local evidence ID:

```ts
type RetrievedEvidence = {
  evidenceId: string;
  source: SemanticSourceSnapshot;
  span: SemanticSpan;
  score: number;
  overlayGeneration: number;
};
```

The registry behind each ID remains application-owned. The model may issue
several retrievals and then returns a structured decision that selects only
evidence IDs it actually used:

```ts
type SynthesisDecision =
  | {
      status: "answered";
      response: string;
      evidence: { evidenceId: string; use?: string }[];
    }
  | {
      status: "insufficient";
      reason?: string;
    };
```

The optional `use` value explains the evidence's role; it is model-authored
annotation, not provenance. The application should not require the model to
invent exact quote offsets inside a retrieved span.

Before publication, application code must verify that:

- every selected ID was issued during this attempt;
- an answered result selects at least one evidence item;
- selected hits resolve to valid stored-by-value citations;
- selected citations still match the active source revision and encoding;
- the Derived Output definition was not superseded during synthesis.

Only selected evidence needs source-revision preflight. If selected evidence
changed during synthesis, discard the attempt and retry within the configured
bound. An insufficient result, an answered result without valid evidence, or a
model response that fails the structured contract must not publish unsupported
prose; expose an explicit cannot-answer result instead.

### Current implementation to replace

The current implementation makes `retrieve` return metadata-only opaque handles,
requires `read` to reveal text and capture citations, and accepts a plain-text
final response. That controlled-door design is safe but unnecessarily indirect
for this product. Replace it with retrieval-returned evidence plus structured
evidence selection as described above.

## Derived Output lifecycle

Keep the Semantic Overlay and Derived Output lifecycles independent:

- overlay source changes translate and advance overlay generation;
- reading a Derived Output computes freshness from its cited source revisions;
- an unrelated overlay generation change does not stale the response;
- refresh validates only selected cited sources before publication;
- provider failure or repeated source churn preserves the last good response;
- a scheduled interval may perform the same pull-based freshness read later;
  source updates should not fan out writes over all Derived Outputs.

The user must be able to edit `lastResponse`. A user-edited response becomes the
continuity example supplied on the next refresh so the agent preserves format
and structure. It remains context, never factual evidence. The public update
operation does not currently accept such an edit and must be extended. Before
implementation, decide whether a user edit advances `lastRevision` or receives
separate edit/version metadata.

## Follow-up sequence

1. Wire source translation and persistence around the existing token-field,
   segmentation, and windowed-passage primitives.
2. Add explicit complete-passage embedding.
3. Replace retrieve/read with retrieval-returned evidence and structured final
   evidence selection.
4. Add user editing of `lastResponse` and its revision semantics.
5. Add source-local large-text and reader window planning.
6. Add an optional bounded query frontier with truncation diagnostics and recall
   tests.

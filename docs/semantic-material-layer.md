# Semantic Material Layer

Status: implemented on `work/derived-output-architecture`, 2026-09-07.

This is the code-level reference for discovering tables, CSV data, charts,
images, code, and spreadsheets without pretending that an interpretation is
the source itself. Its visual companion is served at
`/demo/semantic-overlay/material-layer`; the tool contract is served at
`/demo/semantic-overlay/resource-reading`.

The load-bearing rule is:

> Search meaning. Read authority.

`retrieve` continues to search exact authored text. `retrieve_materials`
searches a second, explicitly interpreted lane. A native `read_*` tool then
opens bounded source material whenever the answer needs exact values, code, or
depicted details.

## What is live

- one resource walk emits an exact UTF-16 projection and first-class material
  seeds;
- document and slide-deck writes enqueue exact and material work;
- backfill covers documents, decks, spreadsheets, and external files;
- material kinds are `table`, `csv`, `chart`, `image`, and `code`;
- deterministic profiles, structured generated descriptors, authored facets,
  and Jina v4 native-image vectors are implemented;
- text and material objects use separate recursive indexes in the same
  embedding space;
- `retrieve_materials` groups facet matches by material and enforces the same
  project and Resource Set boundary as exact retrieval;
- aggregate authored/generated facets retain every contributing resource ref;
  a scoped query may use them only when every contributor is inside the active
  Resource Set, while safe identity/profile/native-visual facets remain reusable;
- external UTF-8 prose/code can also enter the exact lane, pinned by file hash;
- native reads issue typed, attempt-local evidence IDs;
- currentness is checked when searching, when resolving a material handle,
  when reading a Derived Output, and immediately before publication;
- Helios/Selene reference surfaces and deterministic tests exercise the
  architecture.

The final section names the deliberately deferred adapters and scale work. A
deferred item is not implied to exist by the diagrams.

## Two retrieval lanes

| Lane | Objects | Search | Result authority |
| --- | --- | --- | --- |
| `text` | exact source spans | `retrieve` | verbatim, distance 0 |
| `material` | identity, profile, authored, generated, and native-visual facets | `retrieve_materials` | interpreted discovery, distance 2 |

The lanes share project scope, Resource Set evaluation, embedding provider,
model, dimensions, overlay generation, and recursive-index implementation.
They do not share tree roots. A generated material summary therefore cannot
change the neighborhood traversed by ordinary exact-text retrieval.

Native reads do not query either lane. They resolve a handle against the
current project resource and mint evidence from that authority.

## End-to-end procedure

### Normal product entry

```text
submitDocumentChanges / submitSlideDeckChanges
  → persist accepted leader revision
  → enqueueSemanticSync
      → readSemanticSyncTargetFor
      → enqueueSemanticSyncFor                 (when an exact lane applies)
      → readMaterialSyncTargetFor
      → enqueueMaterialSyncFor
  → return to the editor
```

Queue-time work reads only identity and revision metadata. It does not open
native bytes, walk a resource body, embed content, or call intelligence.

### Development and migration entry

```text
backfillSemanticOverlay
  → enumerate document/deck/spreadsheet leaders and external files
  → enqueue the same exact/material job shapes
  → processSemanticSyncQueueFor(limit)
```

Backfill is an entry adapter, not a second translation algorithm.

### Bounded worker

`processSemanticSyncQueueFor` processes the exact queue and then the material
queue for the project. Both queues coalesce by canonical resource reference,
retain only the highest requested revision, and requeue work that loses a race
to a newer authoritative revision.

Exact processing calls:

```text
syncSemanticResourceFor
  → readSemanticResourceForModel
  → EmbeddingModel.tokenField
  → prepareTranslation
  → EmbeddingModel.windowedPassages
  → completeTranslation
  → re-read authoritative revision/hash
  → publishSemanticTranslation
  → stageSemanticIndex(lane = "text")
```

Material processing calls:

```text
syncSemanticMaterialsFor
  → readMaterialInventoryFor
  → normalizeMaterials                         (dedupe identity + placements)
  → deterministic profile/context hashes
  → describeMaterial                           (when enabled/significant)
  → embedMaterialFacets                        (text facets + optional image)
  → re-read inventory and compare signature
  → publishSemanticMaterials
  → stageSemanticIndex(lane = "material")
```

Both publishers stage a complete successor index before retiring current
objects. Retired sources, materials, and semantic objects are copied by value
into history.

## One projection seam

`projectResource` is the common document/deck dispatcher. It returns:

```ts
type ProjectSemanticProjection = {
  exact: {
    ref: ResourceRef;
    revision: number;
    encoding: "utf-16";
    text: string;
    locators: SemanticLocatorSpan[];
    hardBoundaries: number[];
  };
  materials: MaterialSeed[];
};
```

Resource adapters own traversal and locators. Shared content rules decide what
is exact narrative and what becomes a material. Synthetic labels such as
`Slide 1` and resource titles are never inserted. Names remain resource
metadata, outside evidence spans. Blank-line separators exist only between
actual text units. Slide boundaries are coordinate metadata, so translation,
direct reads, and citation consolidation cannot bridge slides.

Prompt Block output is excluded from both exact text and material context. It
cannot recursively become evidence for a later generated answer.

### Current projection matrix

| Source | Exact lane | Material lane |
| --- | --- | --- |
| document | text/formula blocks; image alt/caption; authored table header rows | every table and sourced image, including nested table/image blocks |
| slide deck | visible text/formula/shape text; image alt/caption; authored table header rows; notes | visible slide tables, charts, images, nested materials, and direct image backgrounds |
| spreadsheet | none yet | one native sheet/table material over ordered row/column IDs and `sheetCells` |
| external plain UTF-8 text/Markdown | complete text, up to 5 MB, hash pinned | no material unless a recognized specialist applies |
| external code | complete UTF-8 text, up to 5 MB, hash pinned | code structural profile and optional descriptor |
| external CSV/TSV | none | parsed/profiled CSV material |
| external image | none | image profile, optional descriptor, optional native visual vector |
| unsupported structured data subkind | none | fails explicitly until a type adapter exists |
| unrelated unsupported binary | none | ignored until a type adapter exists |

Raw table bodies are deliberately absent from ordinary exact retrieval. Their
relationships and values remain native and are discoverable through the
material profile, then citable through `read_table` or `read_csv`.

Current slide inventory walks direct slide elements, recursively ordered groups,
notes, and direct slide backgrounds. Document material context includes bounded
authored text on both sides of the material. Slide context includes recursively
ordered group text plus notes without duplicating notes into nearby prose.
Resolving inherited layout/theme-only visual elements is a named follow-up
adapter.

## Material identity and placement

The implemented core shapes live in
`representation/data/types/semantic/material.ts`:

```ts
type MaterialKind = "table" | "csv" | "chart" | "image" | "code";

type MaterialSource =
  | {
      kind: "resourceContent";
      ref: ResourceRef;
      revision: number;
      locator: MaterialLocator;
    }
  | {
      kind: "externalFile";
      ref: ResourceRef;
      fileId: Id<"externalFiles">;
      hash: string;
      mediaType: string;
      subkind: FileSubkind;
    };
```

Every material has a `name`; not every material has a filename. Native tables
and charts are named from authored structure or a stable interface fallback.
External files retain their upload name in the external-file authority.

An immutable uploaded image uses one identity keyed by file ID and content
hash. Every use in a document, slide, nested table cell, or slide background is
a separate `semanticMaterialPlacements` row with its own resource revision,
locator, context, and context hash. The same pixels are embedded once while
placement-specific navigation remains intact.

Deduplication must not widen a Resource Set. Aggregate `authored` and
`generated` facets therefore store `scopeRefs`: the sorted, unique refs for
every placement/source whose context contributed to the facet. With an explicit
Resource Set, the facet is eligible only when **all** those refs match. Asset
identity, the non-authored image profile digest, and the native visual vector
remain reusable whenever the material itself has an in-scope source or
placement. Legacy contextual facet rows without contributor provenance fail
closed under an explicit set until backfill republishes them. Whole-project
search can still use them.

If a resource removes the final placement of an external image, the image
material remains available as a standalone project file with
`placementCount: 0`. Resource-owned tables/charts retire when their resource no
longer contains them.

## Deterministic profiles

Profiles are created before model generation and remain useful if generation
or image embedding fails.

| Kind | Profile authority | Current bound |
| --- | --- | --- |
| table | native cell matrix, header rows, types, null/distinct/min/max, merge count, stratified sample | 12 sampled rows; 1,000 values for exact distinct count |
| CSV/TSV | bounded RFC-4180-style parse, delimiter, headers, types, diagnostics, stratified sample | 5 MB, 20,000 parsed rows, 256 columns, 200,000 cells, 16 sample rows |
| chart | native slide chart specification, type/title/series/axes/labels | 2,000 walked nodes, 100 labels; native read payload capped at 60,000 serialized characters |
| image | source, SHA-256 identity when uploaded, media type, authored alt/caption, placement count | semantic visual input at most 5 MB |
| code | recognized language, lines, imports, exports, declaration outline | 2 MB / 50,000 lines / 500 symbols for the profile |

Code profiling uses a bounded regular-expression outline, reports that parser
mode, and does not claim AST precision. Recognized code extensions and media
types are explicit; generic `text/plain` and Markdown are not mislabeled as
code.

CSV profiling may truncate and says so. `read_csv` currently reuses the same
bounded parser, so rows beyond those limits are not readable in this slice.
Large-file partition/streaming readers are deferred rather than silently
claiming complete coverage.

## Generated descriptions

`describeMaterial` receives only a bounded structured envelope:

```ts
{
  identity: { kind, name },
  profile,
  authored: { title, caption, alt, userDescription, nearbyText, notes },
  sourceRevision: revision | { hash }
}
```

For a content-addressed image it can also receive original image bytes through
the multimodal intelligence port. The structured response contains summary,
purpose, entities, measures, dimensions, time range, themes, uncertainty, and
coverage. It stores model name, prompt version, input hash, and generation
time.

Generation thresholds are intentionally simple: images require available
native input; tables require at least four cells; code requires at least five
lines; CSV and charts qualify. `semanticOverlay.materials.generateDescriptors`
can disable generated descriptors while deterministic facets remain live.

A descriptor is reused only when its input hash, prompt version, and configured
model match. Enabling descriptor generation or changing model, prompt, or input
automatically invalidates the prior policy state. Disabling it republishes the
material without its old descriptor or generated facet. A stable
bounded/native-read failure is not retried on every ordinary sync; a force
request or changed input retries it. The coverage label refers to the bounded
profile/envelope, not an unbounded claim that every underlying byte was given
to the model.

## Searchable facets

Each material may publish up to five independent objects:

| Facet | Input | Trust |
| --- | --- | --- |
| `identity` | name and kind | exact metadata |
| `profile` | deterministic profile digest; image digest excludes placement alt/caption | exact derived structure |
| `authored` | title, caption, alt, nearby text, notes, user description | authored assertion, contributor-scoped |
| `generated` | structured descriptor fields | interpreted, contributor-scoped |
| `nativeVisual` | original image bytes or URL supplied to Jina v4 | native similarity only |

Every facet has its own `inputHash`. Material search overfetches up to five
facets per requested result, groups by `materialId`, reports all matched facets,
then returns `topK` distinct materials.

Facet vectors are reused independently by facet kind and input hash. Changing
placement context can therefore re-embed only the changed authored/generated
text while retaining identical identity/profile vectors and the content-hashed
native image vector. A forced synchronization deliberately bypasses reuse.

`scopeRefs` is facet provenance, not another caller-controlled filter. The
application computes it during normalization, hashes it with aggregate context,
persists it on contextual semantic objects and their history snapshots, and
applies it before vector traversal. A model cannot omit or widen it.

A visual-vector match contains no factual text. If it is the only match,
Derived Output issues descriptor evidence from the separately hashed
deterministic profile—not from the visual hash and not from an unrelated
generated summary. Visual similarity routes the agent to `read_image`; it does
not itself establish what the image depicts.

## Persistence

The live tables are:

- `semanticMaterials`: active identity, source, profile, hashes, descriptor,
  state, and bounded errors;
- `semanticMaterialPlacements`: resource-specific placement and context;
- `semanticMaterialJobs`: coalesced queued/running/failed work;
- `semanticMaterialHistory`: retired material snapshots;
- `semanticObjects`: discriminated `text` or `material` objects; contextual
  material objects include contributor `scopeRefs`;
- `semanticIndexes`: one row per lane with independent roots;
- `semanticObjectHistory`: retired text or material object values.

`externalFiles.subkind` is required and persisted. Every reader consumes that
current field directly; missing-subkind rows are not interpreted.

Native External bytes sit behind
`ExternalFileStorageModel.read({ storageId, hash, size })`. External derives the
descriptor at admission; the storage model validates the content-addressed ID,
recomputes both hash and size on every read, and returns no bytes when the object
is missing. Current profilers/readers then apply their bounded parse or
selection. The same model owns durable publication claims and startup
reconciliation; a future object-store adapter must preserve those semantics
without changing the semantic or Derived Output APIs.

## Retrieval and resource reading

`retrieve_materials({ text, kinds?, topK?, scope? })` embeds one query, searches
only eligible current material objects, groups facet matches, and returns a
material snapshot plus an attempt-local `materialHandle`. Stored scope comes
from the Derived Output; the model cannot widen it.

The agent receives sixteen tools in one bounded run:

```text
evidence:   retrieve · retrieve_materials · read_selection
            read_text · read_table · read_chart · read_csv · read_code · read_image
orientation: find_resources · list_document_blocks · list_deck_slides
             inspect_dataset · inspect_code · inspect_slide · view_slide
```

`retrieve` is the only tool that queries the exact Semantic Overlay.
`retrieve_materials` is the only tool that queries the material Semantic
Overlay. Every `read_*` tool reads the current authoritative resource directly.

Attempt-local material handles include material revision key, profile hash,
context hash, and placement snapshot. A native read rejects an unissued,
out-of-scope, or stale handle.

Current native read bounds:

- `read_text`: one UTF-16 range, maximum 20,000 code units, never across a hard
  boundary;
- `read_table`: at most 100 rows by 50 columns per call;
- `read_chart`: selected named series only, with a 60,000-character native
  payload cap; a requested subset must be isolatable;
- `read_csv`: at most 100 explicit row indexes and 50 named columns;
- `read_code`: at most 500 lines;
- `read_image`: original content-addressed bytes plus an optional validated
  crop coordinate in the citation.

The image tool currently sends the original raster to the model and binds crop
coordinates as metadata; server-side raster cropping is deferred. URL-backed
images may contribute discovery vectors, but mutable remote pixels cannot be
durable evidence. They must be imported into content-addressed storage before
`read_image` will issue an evidence ID. Raw `storage` image sources similarly
await the upload/object-store adapter.

`view_slide` currently produces a deterministic schematic SVG from the
normalized deck body. It composes nested group coordinates into absolute
frames, applies element rotation, and scales normalized frames into the deck's
aspect-ratio canvas. It is explicitly supporting context, not a
production-fidelity slide render and never evidence. A production renderer can
later replace that view adapter without changing `inspect_slide` or native
evidence.

## Evidence distance

| Distance | Durable evidence | Use |
| --- | --- | --- |
| `0` | exact source span or code lines | quotation and direct source claims |
| `1` | bounded table/CSV/chart selection or original pixels | claims interpreted from native material |
| `2` | material descriptor/profile facet | relevance, topic, purpose, inventory |
| none | resource order, handles, structure, schematic slide view | reasoning context only |

All evidence IDs live for one synthesis attempt. The model returns only IDs and
short `use` annotations. Application code resolves them, rejects unknown or
duplicate selections, rechecks currentness, and stores citations by value. It
never persists runtime handles as provenance.

## Freshness and failure behavior

Editable resources are current by leader revision. External exact text is
current by the required External row revision plus content hash. External material is current by
canonical subkind, media type, name, and content hash. Placements are current by
their containing resource revision.

Stale objects remain resolvable while an old recursive tree is being replaced,
but they are removed from the eligible object set before traversal. This keeps
tree integrity without allowing stale search hits. A stale material handle is
also rejected before a native read.

Descriptor failure and native image-embedding failure are non-fatal to the
material record. Deterministic text facets publish with a bounded error so the
material remains discoverable. A later successful refresh clears the error.
Provider and credential details are redacted from persisted failure messages.

Placement-only changes reuse unchanged native facets and bytes. Revision/hash
races return `superseded`; the queue retains or recreates the newest work.
Changes to the set of context-contributing placements change `contextHash`, so
contextual facets are republished with their new scope even if their text happens
to be identical.

## Extension contract

Adding a new resource kind should require four narrow decisions:

1. a cheap queue-time authoritative revision/hash lookup;
2. a traversal adapter that emits exact text and/or `MaterialSeed` values;
3. a deterministic, bounded native profile;
4. an authoritative bounded reader that produces the correct evidence type.

Do not add synthetic prose to make a structured source look text-like. Do not
turn an extraction guess into a native table silently. PDF/screenshot table
extraction becomes structured authority only after a deterministic confidence
policy or user confirmation creates canonical cells.

User-authored material descriptions can plug into the existing `authored`
facet without replacing generated descriptions. Incoming-reference summaries
can become another bounded context input later; they must exclude Prompt Block
output and must change the context hash.

## Deliberately deferred

- transactional leader-write/outbox commits in the JSON store;
- an always-on worker host, leases, recovery, and backoff;
- incremental/delta indexing instead of full per-lane replacement;
- provider-token-aware windowing for exact text above 5 MB;
- streaming/partitioned CSV and repository-scale code readers;
- XLS/XLSX and other structured-file adapters;
- production-fidelity slide rendering and inherited layout/theme resolution;
- server-side image crop generation, image dimension extraction, and the
  content-addressed upload/object-store adapter;
- URL-image import/cache policy;
- OCR and table extraction from PDFs or images;
- audio/video material adapters;
- material-specific reranking and descriptor quality evaluation;
- user correction/versioning of authored and generated descriptions.

These are extension points, not gaps hidden behind current status labels.

## Code map

```text
representation/data/behavior/semantic/
├── projection/
│   ├── contract.ts
│   ├── project-resource.ts
│   ├── writer.ts
│   └── resources/{document,slide-deck}.ts
└── materials/{profile,csv,code,external-file,spreadsheet}.ts

capabilities/semantic-overlay/api/
├── enqueue-semantic-sync/
├── process-semantic-sync-queue/
├── query-semantic-overlay/
├── query-semantic-materials/
└── shared/
    ├── resource.ts
    ├── freshness.ts
    ├── material-resource.ts
    ├── material-sync.ts
    ├── material-description.ts
    ├── material-facets.ts
    ├── material-publication.ts
    └── index-publication.ts

capabilities/derived-output/api/shared/
├── synthesis.ts
└── resource-reading.ts

model/server/
├── embedding/
├── intelligence/
└── external-file-storage/
```

## Required verification

Tests must continue to prove:

- document/deck traversal, hard boundaries, locators, and Prompt exclusion;
- table bodies stay out of exact retrieval while nested materials remain
  inventoried;
- exact external text is UTF-8 validated, size bounded, and content-hash pinned;
- image assets deduplicate across placements and survive final placement
  removal;
- descriptor prompt/model/input changes invalidate reuse;
- image embedding failure preserves deterministic facets;
- material searches return distinct grouped materials and never text objects;
- a partial named Resource Set suppresses aggregate contextual facets with any
  out-of-set contributor while retaining safe shared-asset discovery facets;
- exact searches return no material objects and immediately exclude stale
  sources;
- Resource Sets apply equally to search, navigation, and native reads;
- stale attempt-local handles fail;
- every orientation tool issues no evidence ID;
- native readers return bounded, typed evidence;
- native visual similarity never masquerades as descriptor text;
- Derived Output refresh is a zero-provider-call no-op while all selected
  evidence remains current;
- Helios, Selene, narrow layouts, and browser diagnostics remain clean.

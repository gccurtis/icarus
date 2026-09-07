# Semantic Material Layer

This document defines the target path for making structured and visual project
material discoverable through the Semantic Overlay. It covers authored tables,
charts, spreadsheets, raw CSV files, images, code files, and future external
file adapters.

The goal is not to turn every source into prose. The goal is to give an agent a
semantic route to the right native source while retaining the difference
between exact content and interpretation.

The visual companion is served at
`/demo/semantic-overlay/material-layer`. The resource-reading contract at
`/demo/semantic-overlay/resource-reading` defines the specialized tools that
consume the material after discovery.

## Status boundary

### Live now

- `ContentBlock` includes native `TableBlock` and `ImageBlock` values shared by
  documents and slide decks.
- slide elements can contain tables, images, and an untyped chart `spec`;
- spreadsheets store ordered rows and columns in snapshots and native cell
  values in `sheetCells`;
- `externalFiles` stores `name`, `mediaType`, `storageId`, content `hash`,
  origin, and timestamps;
- `FileSubkind` names `text`, `data`, `image`, `audio`, `video`, and `unknown`,
  although it is not currently persisted on `externalFiles`;
- `resource-text.ts` projects document and slide-deck narrative text into one
  UTF-16 source, including table-cell display text plus image alt/caption text;
- the active Semantic Overlay stores only text spans;
- `jina-embeddings-v4` is configured, but the application embedding port only
  accepts strings.

### Target defined here

- a first-class semantic material record;
- resource-specific material inventory adapters;
- deterministic material profilers;
- bounded context assembly and structured description generation;
- separately embedded material facets, including optional native image vectors;
- a material-only recursive index lane;
- `retrieve_materials` plus specialized inspection and native-read tools;
- evidence records that preserve the distance between a claim and its source.

No production behavior described as target is implemented by the reference
page itself.

## Invariants

1. **Search meaning; read authority.** A descriptor makes a material findable.
   The native table, file bytes, code range, chart series, or original pixels
   remain authoritative.
2. **Normal retrieval remains exact.** `retrieve` searches text-span objects
   only. Generated summaries never appear as ordinary text hits.
3. **Material retrieval is explicit.** `retrieve_materials` searches only the
   material lane and labels every returned evidence value as interpreted.
4. **Facets retain provenance.** Name, deterministic profile, user description,
   generated summary, and native visual embedding are stored and embedded
   separately.
5. **A name is not a filename.** Every material has a user-facing `name` and a
   `kind`. Only external-file authority may carry an original filename or media
   type.
6. **Inventory is cheap and complete.** Every first-class material may be
   registered. Expensive generated descriptions are content-addressed,
   prioritized, and never created once per row, cell, or slide.
7. **Prompt output is never source input.** Prompt Block display values do not
   enter text projection, material context, descriptions, or incoming-reference
   enrichment.
8. **Publication is current or discarded.** A result may publish only while its
   resource revision or immutable file hash still matches its input envelope.

## Why this is a second lane

Raw CSV can technically be serialized and sent to a text embedding endpoint;
that does not make it a sound retrieval representation. Repeated values,
missing headers, row volume, and lost column relationships produce weak meaning
and expensive tokens. Images are not prose at all. A generated summary solves
semantic recall, but it is also not a source quotation. Storing exact text and
descriptors in the same undifferentiated object shape would create two failures:

- basic semantic retrieval could return generated statements as though they
  were exact authored text;
- mixed text/material centroids could change text recall even when a query is
  supposed to ignore material descriptors.

The target keeps one project overlay and one configured embedding space while
building independent recursive-index roots for two lanes:

| Lane | Indexed objects | Query tool | Returned evidence |
| --- | --- | --- | --- |
| `text` | authoritative semantic spans | `retrieve` | verbatim text |
| `material` | identity, profile, authored, generated, and native-visual facets | `retrieve_materials` | interpreted material evidence |

Both lanes use the same project scope, Resource Set eligibility, embedding
dimensions, access checks, query budgets, and overlay lifecycle. They do not
share tree centroids or result contracts.

## Material identity

A material is a semantic unit with a native read path. It may be a content block
inside a resource or an external file in its own right.

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
      fileId: Id<"externalFiles">;
      hash: string;
      mediaType: string;
    };

type SemanticMaterial = {
  id: Id<"semanticMaterials">;
  projectId: Id<"projects">;
  kind: MaterialKind;
  name: string;
  source: MaterialSource;
  profile: MaterialProfile;
  userDescription?: string;
  descriptor?: GeneratedMaterialDescriptor;
  state: "profiled" | "describing" | "ready" | "stale" | "error";
  updatedAt: number;
};
```

`name` is universal. A document table might be named from its caption, nearby
heading, explicit table name, or a stable neutral fallback such as `Table 2` in
the interface. That fallback is metadata and must not be injected into exact
text. A CSV can keep its upload name, but the semantic contract does not require
a `filename` field because authored tables and charts have no file.

## Material kinds and native authority

| Kind | Identity and profile | Descriptor inputs | Native reader |
| --- | --- | --- | --- |
| `table` | dimensions, headers, cell types, merged regions, bounded statistics | native profile, caption/title, neighboring text, slide notes or document heading | `read_table` |
| `csv` | delimiter, encoding, headers, inferred types, row count, bounded statistics, parse diagnostics | profile, bounded stratified samples, name, user description, later incoming references | `read_csv` |
| `chart` | normalized chart type, axes, series, labels, ranges, source handles | native chart values, title, legend, surrounding text, slide context | `read_chart` |
| `image` | media type, dimensions, asset hash, alt text, placements | original pixels, caption/alt, bounded placement context, user description | `read_image` |
| `code` | language, line count, parser diagnostics, imports/exports, symbol outline | name, symbol graph, bounded source chunks, user description, later incoming references | `read_code` |

An extraction result is not automatically a native table. PDF, document-image,
or screenshot table detection belongs to an upstream import/extraction process.
It creates a table material only after a deterministic parser, an explicit
confidence policy, or user confirmation has produced canonical cells. Until
then, it remains text or image material.

## Resource inventory adapters

Resource kinds determine traversal. Shared material adapters determine how a
content kind is identified and read.

### Document

- keep narrative text in the exact projection;
- inventory every native `TableBlock` and sourced `ImageBlock`;
- use table captions, image captions/alt text, nearest preceding heading, and a
  bounded before/after text window as descriptor context;
- do not include Prompt Block output;
- avoid naively embedding large table bodies as prose. Authored labels may stay
  exact text, while native values are represented by the profile and reader.

### Slide deck

- retain the deterministic slide and element traversal already used for text;
- inventory table, chart, and image elements plus image backgrounds;
- preserve slide ID, element path, frame, and placement as metadata;
- use slide narrative text and speaker notes as bounded context;
- never inject synthetic `Slide 1` strings into either lane;
- treat a rendered slide as supporting context, not evidence.

### Spreadsheet

- inventory a workbook-level material and sheet/table/range children only when
  they are meaningful retrieval units;
- profile native `sheetCells` through ordered row/column IDs;
- do not generate one descriptor per cell or row;
- create partition descriptors for very large datasets only when a deterministic
  partition plan materially improves recall.

### External file

- persist or deterministically resolve a specific subkind such as
  `externalFile::csv`, `externalFile::image`, or `externalFile::code`;
- use the existing content hash as the immutable freshness and reuse key;
- parse/profile according to media type before asking a model for a summary;
- keep parsing errors and unsupported encodings explicit;
- external prose files can continue into the exact text lane after extraction.

## Profiling before generation

Every supported material receives a deterministic profile first. The profile is
cheap, inspectable, testable, and useful even if generation is unavailable.

Examples:

- CSV/table: dimensions, headers, inferred column types, null counts, ranges,
  categorical cardinality, parse warnings, and bounded samples;
- image: media type, dimensions, content hash, alt text, and placement count;
- code: language, line count, imports/exports, declarations, parser status, and
  symbol ranges;
- chart: normalized chart type, axes, series names, data ranges, and source
  references.

Profiles must be bounded. High-cardinality values, entire CSV rows, raw image
bytes, and whole source files are not copied into the descriptor prompt.

## Context envelope and description

`assembleMaterialContext` creates a structured, size-bounded envelope:

```ts
type MaterialContextEnvelope = {
  identity: { kind: MaterialKind; name: string };
  profile: MaterialProfile;
  authored: {
    userDescription?: string;
    title?: string;
    caption?: string;
    alt?: string;
    nearbyText?: LocatedText[];
    notes?: LocatedText[];
  };
  nativeSample?: BoundedNativeSample;
  sourceRevision: number | { hash: string };
};
```

The generated output is structured rather than unconstrained prose:

```ts
type GeneratedMaterialDescriptor = {
  summary: string;
  purpose?: string;
  entities: string[];
  measures: string[];
  dimensions: string[];
  timeRange?: string;
  themes: string[];
  uncertainty: string[];
  coverage: {
    mode: "complete" | "sampled";
    description: string;
  };
  model: string;
  promptVersion: string;
  inputHash: string;
  generatedAt: number;
};

type MaterialDescription =
  | { provenance: "authored"; text: string }
  | {
      provenance: "generated";
      text: string;
      model: string;
      promptVersion: string;
      coverage: GeneratedMaterialDescriptor["coverage"];
    };

type MaterialProfileDigest = {
  facts: string[];
  warnings: string[];
};
```

User-authored description and generated summary are never merged in storage.
Both may be searched, but a result reports which facet matched.

The embedding model does not generate this description. Text/table/code
descriptors use the configured structured intelligence model. Image descriptors
require a vision-capable intelligence operation over original pixels plus the
bounded context envelope. If that operation is unavailable or fails, identity,
profile, authored, and native-visual facets can still publish without a
generated summary.

## Searchable facets

A material can emit several semantic objects:

| Facet | Source | Trust label | Example |
| --- | --- | --- | --- |
| `identity` | deterministic | exact metadata | name, kind, language |
| `profile` | deterministic | exact derived structure | headers, measures, symbol outline |
| `authored` | user | authored assertion | user-provided description |
| `generated` | model | interpreted | semantic summary and themes |
| `nativeVisual` | original pixels | native similarity | Jina v4 image vector |

Facets are embedded separately and grouped by `materialId` after search. This
prevents generated prose from hiding that a hit was actually caused by a name,
header, user assertion, or visual similarity. It also lets ranking apply stable
facet weights later without regenerating descriptions.

For images, `jina-embeddings-v4` can embed image bytes or a URL into the same
vector space used by text queries. The current adapter still needs a typed image
operation and provider-response tests. The image vector improves discovery; the
original pixels remain the evidence read by `read_image`.

## Retrieval and tools

### Existing exact-text query

`retrieve` continues to call the existing Semantic Overlay query and returns
text spans with evidence IDs. It never returns material descriptions.

### Material query

```ts
retrieve_materials({
  query: string;
  kinds?: MaterialKind[];
  topK?: number;
}) -> {
  hits: Array<{
    evidenceId: string;
    evidenceKind: "interpreted";
    materialHandle: string;
    kind: MaterialKind;
    name: string;
    profile: MaterialProfileDigest;
    description?: MaterialDescription;
    matchedFacets: MaterialFacet[];
    source: MaterialSourceSnapshot;
    freshness: "current";
    score: number;
  }>;
}
```

The application injects project and Resource Set scope. Result grouping
consolidates multiple matching facets for the same material. A returned evidence
ID identifies the exact descriptor revision and native source snapshot used.
Only current material revisions enter the searchable index. Stale descriptors
remain inspectable history or diagnostics; they are not returned as evidence.

### Orientation and native reading

- `inspect_dataset` exposes sheets, partitions, columns, and bounded sampling
  handles without evidence IDs;
- `inspect_code` exposes symbols and exact ranges without code content or
  evidence IDs;
- `inspect_slide` continues to expose typed content handles and placement;
- `view_slide` remains supporting context only;
- `read_csv` returns bounded native rows and column selections;
- `read_table` returns native cells and relationships;
- `read_chart` returns normalized native axes, series, labels, and values;
- `read_code` returns exact line/symbol ranges;
- `read_image` returns original pixels or an exact crop.

All `read_*` results mint evidence IDs. They do not query either Semantic
Overlay lane.

## Evidence distance

The durable evidence record must expose how far a claim is from its source:

| Distance | Evidence | Appropriate claims |
| --- | --- | --- |
| `0 · verbatim` | exact text or code range | quotations and direct source statements |
| `1 · native` | cells, rows, series, or pixels | calculations and descriptions interpreted from source material |
| `2 · descriptor` | generated semantic descriptor | broad relevance, topic, purpose, and inventory claims |
| none | order, handles, placement, composite slide view | reasoning context only; never selected as evidence |

A descriptor can support “the project contains a dataset about regional
incident response.” It cannot alone support “the Northeast median response time
was 18.4 minutes.” The latter requires a native CSV selection.

## Freshness, reuse, and cost

Material work runs independently from exact text translation:

1. accept the resource write or immutable upload;
2. enqueue/coalesce material inventory by resource revision or file hash;
3. inventory and profile synchronously inside a bounded worker action;
4. reuse an existing descriptor when content hash, profiler version, context
   input hash, and prompt version match;
5. generate missing descriptors and embed changed facets;
6. re-read the authoritative revision/hash;
7. publish current material records and rebuild the material index;
8. mark older records/history without allowing late work to win.

An image asset is content-addressed once. Each document/slide usage becomes a
placement record that may contribute local context without duplicating the
native image vector. Generated placement-specific facets are added only when
the surrounding context materially changes meaning.

The initial cost policy is:

- inventory all recognized materials;
- profile all supported materials;
- embed deterministic identity/profile facets;
- describe first-class materials above type-specific significance thresholds;
- lazily enrich low-value or very large material when a query or user action
  demands it;
- never summarize every row, cell, or slide by default.

## Storage and index migration

Add durable material and placement tables rather than hiding summaries in text
sources:

```ts
semanticMaterials
semanticMaterialPlacements
semanticMaterialJobs
semanticMaterialHistory
```

Generalize the searchable object target while preserving one object ID space:

```ts
type SemanticObjectTarget =
  | {
      lane: "text";
      semanticSourceId: Id<"semanticSources">;
      span: SemanticSpan;
    }
  | {
      lane: "material";
      semanticMaterialId: Id<"semanticMaterials">;
      facet: MaterialFacetKind;
    };
```

Add `lane: "text" | "material"` to each semantic index row and build separate
roots. Migrate existing objects and indexes to `lane: "text"` before publishing
material objects. Query code must select a lane before tree traversal, not
filter a mixed tree after centroid construction.

## Target code layout

```text
capabilities/semantic-overlay/
├── projection/                    exact text lane
│   ├── contract.ts
│   ├── writer.ts
│   ├── resources/
│   │   ├── document.ts
│   │   ├── slide-deck.ts
│   │   ├── spreadsheet.ts
│   │   └── external-file.ts
│   └── content/
│       ├── text.ts
│       ├── formula.ts
│       └── authored-labels.ts
├── materials/                     interpreted material lane
│   ├── contract.ts
│   ├── inventory/
│   │   ├── document.ts
│   │   ├── slide-deck.ts
│   │   ├── spreadsheet.ts
│   │   └── external-file.ts
│   ├── profile/
│   │   ├── table.ts
│   │   ├── csv.ts
│   │   ├── chart.ts
│   │   ├── image.ts
│   │   └── code.ts
│   ├── assemble-material-context.ts
│   ├── describe-material.ts
│   ├── embed-material-facets.ts
│   └── publish-material-revision.ts
└── query/
    ├── retrieve-text.ts
    └── retrieve-materials.ts
```

Resource adapters own traversal and locators. Type-specific profilers own native
shape. The description and index layers operate only on the shared contracts.

## Implementation sequence

1. Persist external-file subkind and define `SemanticMaterial`, source,
   placement, profile, descriptor, and facet types.
2. Split the current `resource-text.ts` monolith into exact projection and
   material inventory outputs without changing live text behavior.
3. Implement and test document and slide-deck material inventories for existing
   `TableBlock` and `ImageBlock`; normalize slide chart specs before treating
   charts as native evidence.
4. Add CSV and code external-file profilers with strict byte, row, column, line,
   and parser limits.
5. Add spreadsheet inventory and bounded native-range profiling.
6. Add the material job/outbox lifecycle, currentness checks, history, and
   content-addressed reuse.
7. Add structured descriptor generation and separate facet embedding.
8. Extend the Jina adapter with image input and verify text-to-image retrieval in
   a non-functional provider test.
9. Migrate semantic objects/indexes to explicit lanes and implement
   `retrieve_materials`.
10. Implement `inspect_dataset`, `inspect_code`, `read_csv`, and `read_code`,
    then connect existing table/chart/image readers to the shared evidence
    registry.
11. Add agent policies, evaluation fixtures, UI evidence rendering, and stale
    material diagnostics.

The first executable slice should stop after steps 1–3: material identity,
inventory, and deterministic profiles. That proves the extension seam without
introducing generation cost or changing retrieval behavior.

## Required tests

- a document table and slide table produce equivalent material contracts;
- repeated image assets reuse one native material and preserve each placement;
- CSV profile limits hold for large, malformed, sparse, quoted, and mixed-type
  files;
- code profiling remains bounded and degrades explicitly on parser failure;
- Prompt Block output never enters descriptor context;
- stale revision/hash work cannot publish;
- `retrieve` cannot return a material object;
- `retrieve_materials` cannot return a text object;
- facet hits consolidate by material while retaining matched-facet provenance;
- Resource Set and project scope are identical across both lanes;
- descriptor evidence renders as interpreted and cannot masquerade as verbatim;
- exact numerical claims require a selected native range in evaluation;
- text-to-image queries retrieve seeded image fixtures when the provider test is
  enabled;
- Helios and Selene display every evidence class distinctly without relying on
  color alone.

## Deferred enrichments

- incoming-reference discovery for uploaded datasets and code files;
- user confirmation and correction of generated descriptors;
- OCR/table extraction from PDFs and images;
- audio/video material adapters;
- material-specific reranking;
- demand-driven hierarchical partitions for very large datasets and repositories;
- usage-informed regeneration and descriptor quality evaluation.

These enrich the shared material contract. None should require changing the
text retrieval contract or weakening native evidence authority.

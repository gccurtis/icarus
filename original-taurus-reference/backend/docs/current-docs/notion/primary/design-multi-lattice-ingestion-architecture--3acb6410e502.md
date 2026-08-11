---
title: "Design — Multi-Lattice Ingestion Architecture"
notion_page_id: "3acb6410e50281bf8f16ec589da555d3"
notion_url: "https://app.notion.com/3acb6410e50281bf8f16ec589da555d3"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 21:25:01Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Design — Multi-Lattice Ingestion Architecture

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Status:** Governing Taurus Yesod design authority for source classification, projection, semantic indexing, and retrieval across text, structured data, and media. This design preserves the current Taurus Omega Knowledge/KLR behavior while extending ingestion through two independent capabilities.
## 1. Executive decision
Taurus has three mutually isolated semantic lattices:
1. **Text lattice**, owned by the Knowledge capability, retrieves trusted source text and literal transcriptions.
2. **Structured Data lattice**, owned by the Structured Data capability, retrieves exact tables and model regions through inference-generated descriptors.
3. **Media lattice**, owned by the Media capability, retrieves original images through inference-generated descriptors.
The lattices may share a content-agnostic geometric engine and the same operational vocabulary, but they do not share entries, nodes, persistence tables, corpus generations, vector identities, or retrieval calls.
> **The descriptor finds the artifact; the artifact is what the agent uses.**
Text retrieval returns exact source text. Structured retrieval returns an artifact handle whose payload is the exact table or model region. Media retrieval returns an artifact handle whose payload is the original image. A generated descriptor is discovery metadata, not a replacement for the source and not authoritative evidence.
## 2. The apparent overlap rule
“Mutually exclusive lattices” applies to indexed records and vector spaces, not to the canonical source that caused them.
One canonical source may produce more than one separately governed projection:
```plain text
image file revision
  ├── MediaDescriptorProjection ──► Media lattice
  └── OCRTextProjection ──────────► Text lattice, only when OCR yields eligible text
```
No record is stored in two lattices:
```go
type LatticeKind string

const (
    LatticeText       LatticeKind = "text"
    LatticeStructured LatticeKind = "structured_data"
    LatticeMedia      LatticeKind = "media"
)

type ProjectionIdentity struct {
    Kind          LatticeKind
    ProjectionID  string
    SourceVersion SourceVersionRef
    Generation    int64
}
```
An OCR projection and a media descriptor have different IDs, content, provenance, lifecycle, vector identity, and persistence. They merely point to the same immutable source version.
## 3. Shared vocabulary
### 3.1 Source
A Source is a project-authorized Taurus Resource revision, immutable File snapshot, or connector item version. It remains canonical outside every lattice.
```go
type SourceVersionRef struct {
    ProjectID  string
    SourceKind string // resource | file | connector_item
    SourceID   string
    VersionID  string
    Revision   int64
    SHA256     string
    Label      string
}
```
### 3.2 Projection
A Projection is a deterministic or inference-assisted representation built from exactly one authorized source version for one lattice.
- `TextProjection` contains trusted text and exact source locators.
- `StructuredProjection` contains descriptor entries plus exact structured artifacts.
- `MediaProjection` contains descriptor entries plus original-media locators.
Projections are derived, refreshable, replaceable, and never become the source of truth.
### 3.3 Lattice entry
A lattice entry is the semantic unit embedded and clustered by the shared engine:
```go
type Entry struct {
    ID           string
    ProjectID    string
    Lattice      LatticeKind
    LocalScopeID string
    Vector       []float32
    PayloadRef   string
    SourceRef    SourceVersionRef
}
```
- Text entries represent bounded text windows.
- Structured entries represent artifact descriptors.
- Media entries represent image descriptors.
`PayloadRef` is interpreted only by the owning capability.
### 3.4 Artifact
An Artifact is the exact non-text payload found through a descriptor:
- a normalized CSV table;
- an XLSX worksheet region or model region;
- a whole-workbook model map;
- an original image.
Artifacts have stable IDs and source locators. Descriptors may be regenerated without changing artifact identity when the exact selected source content is unchanged.
## 4. Capability ownership
<table header-row="true">
<tr>
<td>Capability</td>
<td>Canonical derived records</td>
<td>Indexed content</td>
<td>Retrieval result</td>
</tr>
<tr>
<td>Knowledge</td>
<td>text projections, windows, text lattice</td>
<td>source text or literal transcription</td>
<td>exact text regions and locators</td>
</tr>
<tr>
<td>Structured Data</td>
<td>structured artifacts, descriptors, tags, structured lattice</td>
<td>generated descriptor text</td>
<td>artifact matches, then exact table reads</td>
</tr>
<tr>
<td>Media</td>
<td>media artifacts, descriptors, media lattice</td>
<td>generated descriptor text</td>
<td>artifact matches, then original image reads</td>
</tr>
<tr>
<td>Intelligence</td>
<td>provider/model routing, inference, reasoning, embedding, OCR casts</td>
<td>none</td>
<td>typed provider result and telemetry</td>
</tr>
<tr>
<td>Ingestion coordinator</td>
<td>classification, job orchestration, receipts</td>
<td>none</td>
<td>accepted routes and job status</td>
</tr>
<tr>
<td>Resource/File/Connector</td>
<td>canonical source versions and authorization</td>
<td>none</td>
<td>exact authorized snapshot</td>
</tr>
</table>
Leaf capabilities do not import one another’s service packages. Wiring supplies narrow ports. Cross-lattice orchestration belongs in a coordinator or agent tool registry, not in Knowledge, Structured Data, or Media.
## 5. Shared lattice engine
Go does not need inheritance. Use composition around a content-agnostic engine:
```go
package lattice

type Engine struct {
    cluster ClusterPolicy
    descent DescentPolicy
}

type CorpusStore interface {
    ReplaceEntries(ctx context.Context, scope Scope, write CorpusWrite) error
    EntryFrontier(ctx context.Context, scope Scope) ([]FrontierEntry, error)
    NodesByID(ctx context.Context, scope Scope, ids []string) ([]Node, error)
    EntriesByID(ctx context.Context, scope Scope, ids []string) ([]Entry, error)
    ReplaceCorpus(ctx context.Context, scope Scope, write CorpusBuild) error
    CorpusIndexes(ctx context.Context, scope Scope) ([]LevelIndex, error)
}

func (e *Engine) BuildSource(entries []Entry) SourceBuild
func (e *Engine) BuildOrRepairCorpus(previous []LevelIndex, frontier []FrontierEntry) CorpusBuild
func (e *Engine) Retrieve(ctx context.Context, store CorpusStore, q Query) (Result, error)
```
The engine owns only:
- vector validation and normalization;
- deterministic IDs and ordering;
- exact and sparse clustering;
- overlapping maximal-clique membership;
- representative construction;
- roots, orphans, frontiers, and DAG descent;
- persisted level indexes and local repair;
- similarity scoring and retrieval budgets.
The engine does not know what a document, table, image, cell, OCR region, or source type is. Capability adapters translate engine entry IDs back into typed results.
Each capability supplies its own `CorpusStore` adapter backed by a separate table family. A vector identity is scoped to one lattice generation. Vectors from different lattices are never compared even if they happen to use the same provider and model.
## 6. Source classification
Classification is deterministic and occurs before a capability is invoked:
```plain text
authorized source snapshot
  → native Resource kind, when available
  → trusted MIME/content signature
  → normalized extension
  → classification policy
  → exactly one primary ingestion route or typed unsupported/ambiguous error
```
The extension is a useful product signal but not sufficient security authority. A file named `report.xlsx` must still be a valid OOXML spreadsheet package before the Structured Data worker opens it.
```go
type SourceClass string

const (
    ClassText       SourceClass = "text"
    ClassStructured SourceClass = "structured_data"
    ClassMedia      SourceClass = "media"
)

type Classification struct {
    Class      SourceClass
    Format     string
    Confidence string // exact | declared | user_selected
}

type UnsupportedSourceType struct {
    Extension    string
    DetectedMIME string
    Allowed      []SourceClass
}
```
V1 routing:
<table header-row="true">
<tr>
<td>Input</td>
<td>Route</td>
</tr>
<tr>
<td>Taurus Document, Chat, Slides</td>
<td>Text</td>
</tr>
<tr>
<td>plain text, Markdown, supported PDF</td>
<td>Text</td>
</tr>
<tr>
<td>CSV</td>
<td>Structured Data</td>
</tr>
<tr>
<td>XLSX</td>
<td>Structured Data</td>
</tr>
<tr>
<td>PNG, JPEG, WebP</td>
<td>Media, with OCR policy evaluated after description</td>
</tr>
<tr>
<td>legacy XLS</td>
<td>typed unsupported-format result; deferred</td>
</tr>
<tr>
<td>unknown or conflicting type</td>
<td>typed ambiguous/unsupported result</td>
</tr>
</table>
The frontend may ask:
> Taurus does not recognize this file type. Should it be treated as text, structured data/table, or picture/media?
A user selection chooses the parser family; it does not disable validation. If the selected parser cannot validate the bytes, ingestion fails with a format-specific diagnostic.
## 7. Translator and projector registry
```go
type IngestionProjector interface {
    Class() SourceClass
    Format() string
    Project(
        ctx context.Context,
        scope Scope,
        source AuthorizedSnapshot,
        policy ProjectionPolicy,
    ) (ProjectionResult, error)
}

type ProjectorRegistry interface {
    Resolve(class SourceClass, format string) (IngestionProjector, bool)
}
```
The registry is assembled in wiring. Projectors do not commit to another capability directly. The ingestion coordinator validates the result and calls the destination capability’s admission port.
## 8. Text projection rules
The current Knowledge ingestion authority remains the detailed text contract. The three-lattice architecture adds explicit native translators:
### 8.1 Document
Translate canonical user-authored text in document order. Exclude prompt instructions, transient runtime state, and generated output unless it has been explicitly canonicalized into ordinary source content.
### 8.2 Chat
Translate the selected persisted branch in stable turn order:
```plain text
Turn 14
User: What did the customer say about procurement?
Assistant: They require SSO and a security review before pilot access.
```
Locators use stable Chat and Turn IDs. Exclude hidden prompts, reasoning, tool payloads, credentials, deleted turns, and drafts.
### 8.3 Slides
Translate stable slide order into a deterministic outline:
```plain text
Deck: Quarterly Review
Section: Results
Slide: 7
Title: Revenue growth
Body:
- Enterprise revenue increased 18% year over year.
Notes: Discuss the renewal cohort separately.
```
Use stable Slide IDs rather than slide names; slides have no canonical names. Include canonical visible text, supported table text, canonical chart labels/values, and notes. Images remain separate Media sources linked to their slide.
### 8.4 PDF, text, and Markdown
Preserve exact page, line, and byte locators. Scanned PDF regions may emit OCR-derived text with explicit OCR provenance. PDF-to-editable-Document import is independent from PDF-to-Text ingestion.
## 9. Structured Data projection rule
Structured Data performs enough up-front work to discover the right artifact later:
```plain text
CSV/XLSX snapshot
  → deterministic parsing and candidate-region extraction
  → bounded descriptor reasoning
  → validated artifacts and descriptors
  → descriptor embeddings
  → Structured Data lattice
```
The reasoning model may name, describe, tag, merge, or split candidate regions by returning source selectors. It never reconstructs the underlying cells. Every selector is validated against the deterministic extraction.
Search returns descriptors and handles. A second read operation returns the exact artifact or a bounded slice.
## 10. Media projection rule
V1 Media supports images:
```plain text
image snapshot
  → image-description inference cast
  → validated media descriptor
  → descriptor embedding
  → Media lattice
  → optional OCR cast according to policy
  → eligible OCRTextProjection
  → Text lattice
```
The description may include visible entities, scene, purpose, chart/diagram form, layout, and other retrieval-oriented details. It must be explicitly labeled generated interpretation. When an agent uses the result, Taurus provides the original image.
The image-description call also returns `visibleTextLikelihood` and `ocrRecommended`. That avoids a separate inference call merely to decide whether OCR should run. When OCR is admitted, a dedicated OCR cast transcribes literal text and returns image-region locators.
## 11. Ingestion lifecycle and cost control
Inference-assisted ingestion is a durable, explicit job:
```go
type IngestionJob struct {
    ID            string
    ProjectID     string
    Source        SourceVersionRef
    Requested     []LatticeKind
    PolicyVersion string
    Status        string // queued | running | partial | complete | needs_attention
    Attempt       int
    RetryAfter    *time.Time
}
```
Rules:
- Cache by source hash, projector version, descriptor-policy version, and resolved model identity.
- Reuse unchanged artifacts and descriptors.
- Batch descriptor embeddings.
- Bound model input by region/sample budgets.
- Enforce per-source and per-project artifact limits.
- Honor provider retry instructions and stop after a durable attempt budget.
- Publish each lattice generation atomically; the prior coherent generation remains readable until replacement succeeds.
- A partial cross-projection result is explicit: an image may have a valid Media entry while OCR fails.
- Telemetry records provider/model identity, cast, latency, tokens, cost, source, and job.
## 12. Agent retrieval surface
The agent sees separate tools:
```go
SearchText(ctx, TextSearchRequest) (TextSearchResult, error)

SearchStructuredData(ctx, StructuredSearchRequest) (StructuredMatches, error)
ReadStructuredArtifact(ctx, StructuredReadRequest) (StructuredPayload, error)

SearchMedia(ctx, MediaSearchRequest) (MediaMatches, error)
ReadMediaArtifact(ctx, MediaReadRequest) (MediaPayload, error)
```
An optional application-level discovery tool may call the three searches concurrently and return partitioned results. It must not collapse scores from different vector spaces into one false numeric ranking. It may apply a result-level policy such as per-lattice quotas or reciprocal-rank fusion while retaining the originating lattice and score.
## 13. Persistence law
Table families remain physically separate:
```plain text
knowledge_* / text_*            Text projection, windows, nodes, indexes
structured_data_*               Structured sources, artifacts, descriptors
structured_lattice_*            Structured entries, nodes, indexes
media_*                         Media sources, artifacts, descriptors
media_lattice_*                 Media entries, nodes, indexes
ingestion_*                     Routing jobs, attempts, receipts, diagnostics
```
No database view or foreign key makes one lattice’s nodes members of another lattice. Cross-projection lineage uses source-version references, not shared lattice IDs.
Every query repeats project scope. Every generated descriptor and transcription records:
- exact source version and hash;
- projector/policy version;
- provider and model;
- cast purpose;
- generation time;
- confidence and diagnostics;
- source locators.
## 14. Security and privacy
- Start only from a server-authorized immutable source snapshot.
- Repeat project scope in every store and object lookup.
- Treat file contents, cell values, document text, image text, and metadata as untrusted data rather than instructions.
- Use isolated, bounded workers for hostile XLSX and media parsing.
- Workers receive no database credentials, connector credentials, project authority, or network access.
- Do not fetch arbitrary URLs during ingestion.
- Apply decoded-byte, pixel, row, column, cell, formula, output, time, memory, and model-input limits.
- Do not log source text, table values, images, credentials, or provider payloads.
- Respect retention and deletion across canonical source, projections, artifacts, lattice entries, jobs, and telemetry.
## 15. Scope
### V1
- Three isolated lattices and a shared geometric engine.
- Existing Text ingestion plus Chat and Slides translators.
- CSV and XLSX Structured Data ingestion.
- PNG, JPEG, and WebP Media ingestion.
- Image descriptor inference.
- Image OCR with configurable `never | auto | always` policy; default `auto`.
- Separate search/read tools.
- Unknown-format frontend classification and typed errors.
### Deferred
- legacy binary XLS;
- audio and video;
- audio transcription;
- direct image embeddings;
- model-generated image captions entering the Text lattice;
- universal cross-lattice score normalization;
- executing arbitrary spreadsheet formulas or macros during ingestion.
## 16. Acceptance evidence
- Each lattice persists to a distinct table family and has a distinct vector identity and corpus generation.
- No retrieval call loads nodes or entries from another lattice.
- One image can produce one Media descriptor projection and one OCR Text projection without sharing any lattice record.
- A CSV search finds the descriptor, and a subsequent read returns byte/lexeme-faithful table content.
- An XLSX reasoning result cannot invent a worksheet or range; invalid selectors fail ingestion.
- Chat citations open the exact Turn; Slides citations open the exact Slide.
- Unknown file types return a typed classification error and supported user choices.
- Reprocessing an unchanged source spends nothing beyond any explicitly requested model-policy change.
- Removing a source removes every derived projection and artifact without affecting unrelated sources or lattices.
## Sources
- <mention-page url="https://app.notion.com/p/3acb6410e50281d19635f051bb5ee6ad"/>
- <mention-page url="https://app.notion.com/p/3abb6410e5028179a844c0af77b21ffe"/>
- <mention-page url="https://app.notion.com/p/3abb6410e50281258d89d5719fa851fc"/>
- <mention-page url="https://app.notion.com/p/3abb6410e50281df8762c162e9a6eb13"/>
- [Current Omega Knowledge contracts](https://github.com/gccurtis/taurus-omega/blob/f621e9d7ff1c2429fd0a3f0bee3b13f04d4be927/core/capability/knowledge/knowledge.go)
- [Current Omega Intelligence contracts](https://github.com/gccurtis/taurus-omega/blob/f621e9d7ff1c2429fd0a3f0bee3b13f04d4be927/core/capability/intelligence/intelligence.go)
- [Resilient ingest design](https://github.com/gccurtis/taurus-omega/blob/f621e9d7ff1c2429fd0a3f0bee3b13f04d4be927/docs/superpowers/specs/2026-07-29-resilient-ingest-design.md)
## Current authority links
- <mention-page url="https://app.notion.com/p/3acb6410e50281bf8f16ec589da555d3">Design — Multi-Lattice Ingestion Architecture</mention-page>
- <mention-page url="https://app.notion.com/p/3acb6410e5028157b9e4e8228237cfb8"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281dfa3abd6a5ed892917"/>
- <mention-page url="https://app.notion.com/p/3acb6410e502811cb1d8d52f81f4c432"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281d19635f051bb5ee6ad"/>


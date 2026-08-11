---
title: "Implementation — Multi-Lattice Ingestion & Migration Plan"
notion_page_id: "3acb6410e502811cb1d8d52f81f4c432"
notion_url: "https://app.notion.com/3acb6410e502811cb1d8d52f81f4c432"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 21:25:01Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Implementation — Multi-Lattice Ingestion & Migration Plan

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Status:** Implementation and migration authority for moving Taurus Omega from one Knowledge-owned text lattice to three capability-owned, independently persisted lattices. This plan is based on Omega `main` at commit [`f621e9d`](https://github.com/gccurtis/taurus-omega/commit/f621e9d7ff1c2429fd0a3f0bee3b13f04d4be927).
## 1. Outcome
After this migration:
- Knowledge owns the Text lattice and preserves current grounded text retrieval.
- Structured Data owns a descriptor lattice plus exact CSV/XLSX artifacts.
- Media owns a descriptor lattice plus original image artifacts.
- Image OCR may produce a separate Text projection with explicit OCR provenance.
- All three capabilities use a shared content-agnostic geometric lattice engine.
- Each lattice has separate stores, tables, vector identity, corpus generation, repair state, and retrieval API.
- A source-classification coordinator routes authorized snapshots before capability admission.
- Chat and Slides have native Text translators.
- Unknown formats return typed errors and frontend classification choices.
The migration must preserve every current Knowledge/KLR behavior and scale result before introducing new capability paths.
## 2. Current Omega baseline
At the reviewed commit:
- `core/capability/knowledge` defines source metadata, full source text, windows, nodes, vector identity, clustering configuration, storage ports, source writes, retrieval, and region assembly in one package.
- Knowledge is explicitly inference-free and uses only a narrow `Embedder`.
- entries are text windows; retrieval returns exact source spans.
- `AddBatch` batches changed windows and defers corpus rebuild.
- corpus clustering supports exact/sparse construction, persisted neighbor indexes, local repair, and descent retrieval.
- embedding routes are single-model because vector spaces are not interchangeable.
- Intelligence supports reasoning, inference, and text embedding; provider messages and embedding inputs remain text-only.
- the resilient-ingest plan is actively moving cited text and block references into self-contained windows and unifying indexed ascent.
This means the reusable geometric system is real, but its types and stores are still text-shaped.
## 3. Migration laws
1. **No flag-selected mechanics.** The engine chooses exact/sparse construction by measured pool size and index presence, as current Omega does.
2. **No cross-capability imports.** Leaf capabilities use narrow ports assembled in wiring.
3. **No cross-lattice vector comparisons.** Equal dimensions or model names do not authorize comparison.
4. **No shared persistence tables.** Shared code does not imply shared rows.
5. **No source rewrite.** Canonical Resources, Files, and connector items remain authoritative.
6. **No descriptor as evidence.** Structured and Media descriptors discover artifacts; agents must read the artifact for grounded use.
7. **No destructive Knowledge cutover.** Existing Knowledge data remains readable throughout extraction and adapter migration.
8. **No hidden provider calls.** Inference-assisted ingestion is a durable job with budgets, telemetry, and receipts.
9. **No silent unsupported input.** Every skipped source or projection has a typed diagnostic.
10. **No user-supplied project scope in agent tools.** Scope comes from execution context.
## 4. Target package topology
```plain text
core/platform/lattice/
  model.go
  engine.go
  cluster.go
  sparse.go
  repair.go
  retrieve.go
  identity.go
  errors.go
  *_test.go

core/capability/knowledge/
  text_projection.go
  translator.go
  service.go
  store.go
  lattice_adapter.go
  regions.go
  ...

core/capability/structureddata/
  model.go
  descriptor.go
  ingestion.go
  projector_csv.go
  projector_xlsx.go
  service.go
  store.go
  lattice_adapter.go
  tools.go

core/capability/media/
  model.go
  descriptor.go
  ingestion_image.go
  ocr.go
  service.go
  store.go
  lattice_adapter.go
  tools.go

core/application/ingestion/
  classifier.go
  registry.go
  coordinator.go
  receipts.go
  errors.go

core/integration/structureddata/csv/
core/integration/structureddata/xlsx/
core/integration/media/image/
core/integration/intelligence/openrouter/

core/platform/storage/sqlite/
  sqlite_knowledge.go
  sqlite_structured_data.go
  sqlite_structured_lattice.go
  sqlite_media.go
  sqlite_media_lattice.go
  sqlite_ingestion.go

core/transport/httpapi/
  ingestion_handlers.go
  structured_data_handlers.go
  media_handlers.go
```
`core/platform/lattice` is justified because three leaf capabilities require the same pure geometric machinery. It has no database, transport, provider, source, or capability imports.
## 5. Shared engine contract
Do not create an inheritance hierarchy. Extract a composable engine:
```go
package lattice

type Kind string

const (
    KindText       Kind = "text"
    KindStructured Kind = "structured_data"
    KindMedia      Kind = "media"
)

type Scope struct {
    ProjectID string
    Kind      Kind
}

type VectorIdentity struct {
    Provider string
    Model    string
    Dims     int
}

type Entry struct {
    ID           string
    ProjectID    string
    LocalScopeID string
    Vector       []float32
    PayloadRef   string
}

type Node struct {
    ID           string
    ProjectID    string
    LocalScopeID string
    Level        int
    Centroid     []float32
    Count        int
    Cohesion     float64
    MemberIDs    []string
}

type Engine struct {
    policy Policy
}

type Store interface {
    ReplaceLocal(ctx context.Context, scope Scope, write LocalWrite) error
    LocalFrontier(ctx context.Context, scope Scope) ([]FrontierEntry, error)
    CorpusState(ctx context.Context, scope Scope) (CorpusState, error)
    ReplaceCorpus(ctx context.Context, scope Scope, write CorpusWrite) error
    EntryFrontier(ctx context.Context, scope Scope, probe Probe) ([]FrontierEntry, error)
    EntriesByID(ctx context.Context, scope Scope, ids []string) ([]Entry, error)
    NodesByID(ctx context.Context, scope Scope, ids []string) ([]Node, error)
}
```
The capability chooses `PayloadRef` semantics:
```plain text
Text:       text-window ID
Structured: structured-artifact ID
Media:      media-artifact ID
```
The shared engine returns entry IDs, scores, and traversal metadata. Capability adapters hydrate typed results.
## 6. Intelligence changes
### 6.1 Cast purposes
Add configured purposes:
```plain text
embedding / knowledge.index
embedding / structured_data.index
embedding / media.index

inference / media.describe.image
inference / media.ocr.image

inference or reasoning / structured_data.describe.csv
reasoning / structured_data.describe.region
reasoning / structured_data.describe.workbook
```
Each embedding purpose has exactly one route. The three purposes may resolve to the same model, but their stored vector identities and lattice scopes remain independent.
### 6.2 Typed multimodal inputs
Extend provider-neutral messages:
```go
type Message struct {
    Role    string
    Content []MessagePart
}

type MessagePart struct {
    Kind  string // text | image
    Text  string
    Image *ImageInput
}

type ImageInput struct {
    FileID   string
    SHA256   string
    MIMEType string
}
```
Preserve compatibility by adapting existing text-only constructors into one `text` part.
Provider adapters resolve image content through an infrastructure-owned reader. Do not let callers pass arbitrary base64 blobs or remote URLs through the capability contract.
### 6.3 Provider capability validation
At startup validate that routes required for image purposes support:
- image input;
- structured JSON output;
- configured size/type limits.
`ErrNoCast` remains the typed result when a deployment has not configured optional media features. OCR and descriptor status must surface that clearly.
## 7. Ingestion coordinator
```go
type Coordinator struct {
    sources    SourceReader
    classifier Classifier
    registry   ProjectorRegistry
    jobs       job.Enqueuer
}

type IngestionRequest struct {
    Source         SourceRequest
    DeclaredClass  *SourceClass
    OCRMode        *OCRMode
    IdempotencyKey string
}
```
The coordinator:
1. authorizes and resolves an exact snapshot;
2. classifies by native resource kind, signature/MIME, and extension;
3. applies a validated user selection when classification is unknown;
4. records a durable job and receipt;
5. invokes the format projector;
6. validates the result;
7. calls the owning capability admission port;
8. schedules any admitted cross-projection branch such as OCR Text;
9. publishes complete/partial/failure status.
Knowledge is not responsible for forwarding CSV/XLSX to Structured Data.
### 7.1 Typed classification errors
```go
var (
    ErrUnsupportedFormat  = errors.New("ingestion: unsupported format")
    ErrAmbiguousFormat    = errors.New("ingestion: ambiguous format")
    ErrFormatMismatch     = errors.New("ingestion: declared type does not match content")
)

type ClassificationError struct {
    Code         string
    Extension    string
    DetectedMIME string
    Choices      []SourceClass
}
```
Frontend responses branch on `Code`, not error prose.
## 8. Persistence migration
### 8.1 Text/Knowledge
Keep existing `knowledge_*` tables as the Text lattice table family. Do not rename them during the functional migration.
Finish the resilient-ingest storage correction first:
- self-contained window text and locators;
- source metadata rather than duplicate source bytes;
- sliced commits and retries;
- indexed ascent unification.
Then adapt `sqlite_knowledge` to `lattice.Store` while preserving existing APIs through the Knowledge adapter.
### 8.2 Structured Data
```sql
CREATE TABLE structured_data_sources (... project_id ..., source_version ..., generation ...);
CREATE TABLE structured_data_artifacts (... project_id ..., source_id ..., kind ..., locator_json ..., payload_ref_json ..., content_hash ...);
CREATE TABLE structured_data_descriptors (... artifact_id ..., descriptor_json ..., evidence_hash ..., policy_version ..., provider ..., model ...);
CREATE TABLE structured_lattice_entries (... project_id ..., artifact_id ..., vector_identity ..., vector_blob ...);
CREATE TABLE structured_lattice_nodes (... project_id ..., level ..., centroid_blob ...);
CREATE TABLE structured_lattice_memberships (... project_id ..., node_id ..., member_id ...);
CREATE TABLE structured_lattice_generations (... project_id ..., generation ..., vector_identity ..., published_at ...);
```
### 8.3 Media
```sql
CREATE TABLE media_sources (... project_id ..., source_version ..., policy_version ..., generation ...);
CREATE TABLE media_artifacts (... project_id ..., source_id ..., file_id ..., locator_json ..., content_hash ...);
CREATE TABLE media_descriptors (... artifact_id ..., descriptor_json ..., evidence_hash ..., provider ..., model ...);
CREATE TABLE media_ocr_results (... artifact_id ..., result_json ..., text_projection_id ..., provider ..., model ...);
CREATE TABLE media_lattice_entries (... project_id ..., artifact_id ..., vector_identity ..., vector_blob ...);
CREATE TABLE media_lattice_nodes (... project_id ..., level ..., centroid_blob ...);
CREATE TABLE media_lattice_memberships (... project_id ..., node_id ..., member_id ...);
CREATE TABLE media_lattice_generations (... project_id ..., generation ..., vector_identity ..., published_at ...);
```
All schemas include foreign keys, project-scoped unique constraints, timestamps, attempt/generation identities, and cascading derived-data cleanup. Store tests must prove that every lookup fails closed across project boundaries.
## 9. Implementation phases
### Phase 0 — Characterize and freeze the current Text lattice
**Goal:** Create a migration oracle before moving code.
- Pin `f621e9d` behavior through current unit/live tests.
- Add package-level golden fixtures for entry IDs, node IDs, memberships, frontiers, retrieval ordering, exact fallback, source repair, corpus repair, vector-identity rejection, and region assembly.
- Record the 596-file scale result and relevant cost/latency numbers.
- Finish or explicitly sequence the resilient-ingest phases that change window storage.
**Gate:** No geometric extraction begins until the current behavior is reproducible.
### Phase 1 — Extract content-agnostic lattice mathematics
**Goal:** Move only types and algorithms that contain no text/source meaning.
- Move vector identity, normalized vector helpers, nodes, memberships, frontiers, clique construction, sparse neighbor index, repair decision, and descent mechanics to `core/platform/lattice`.
- Keep text windowing and region assembly in Knowledge.
- Introduce a Knowledge adapter that maps current windows to generic entries.
- Preserve current content-addressed IDs or provide an explicit one-time compatible mapping.
**Gate:** Existing Knowledge tests and scale suite pass without an API or persistence cutover.
### Phase 2 — Adapt Knowledge persistence and retrieval
**Goal:** Make Knowledge the first consumer of the shared engine.
- Adapt the Knowledge SQLite store to `lattice.Store`.
- Keep existing `knowledge_*` table names.
- Keep current handlers and agent tools stable.
- Generalize text locators for Document, Chat, Slide, PDF page, and OCR image region.
- Preserve inference-free retrieval and exact text regions.
**Gate:** Byte-identical regions and equivalent retrieval against the Phase 0 oracle.
### Phase 3 — Add ingestion classification and translator registry
**Goal:** Route before capability admission.
- Implement native Resource-kind routing.
- Implement MIME/signature and extension mapping.
- Add typed unknown/ambiguous/mismatch errors.
- Add durable ingestion job/attempt/receipt tables.
- Add user-declared classification with parser validation.
- Wire the existing Document path through the registry without changing output.
**Gate:** Known formats route deterministically; unknown types produce frontend choices; user misclassification fails safely.
### Phase 4 — Complete Text translators
**Goal:** Fill the known Text ingestion family.
- Chat → stable attributed turn text and Turn locators.
- Slides → stable outline text and Slide locators.
- Plain text/Markdown → line/byte locators.
- PDF → page text and OCR only for scanned regions according to existing text policy.
- Explicitly exclude generated prompt/runtime material by policy.
**Gate:** Fixtures open exact originating turns, slides, pages, and blocks.
### Phase 5 — Implement Structured Data capability
**Goal:** Ship CSV first, then XLSX.
#### Phase 5A — CSV
- Exact parser and lexeme-preserving payload.
- Schema/profile/sample card.
- descriptor inference cast and JSON validation.
- artifact/descriptor persistence.
- Structured lattice adapter.
- `structured.search`, `structured.inspect`, and `structured.read`.
#### Phase 5B — XLSX
- Reuse the safe Excelize worker contract.
- deterministic candidate-region detector.
- reasoning-based region composition and descriptors.
- workbook map and child artifacts.
- formula/cached-value/dependency preservation without execution.
- embedded image handoff to Media through the coordinator.
**Gate:** Search finds descriptors; reads return exact artifact data; invented selectors fail.
### Phase 6 — Implement Media capability
**Goal:** Ship images without audio.
- Safe PNG/JPEG/WebP admission.
- typed multimodal Intelligence messages.
- `media.describe.image` cast and schema.
- media artifacts/descriptors/tags/store.
- Media lattice adapter.
- `media.search`, `media.inspect`, and `media.open`.
- parent-resource relationships and deduplication by immutable File version.
**Gate:** descriptor search returns and opens the original image; generated descriptions never enter Text.
### Phase 7 — Add OCR cross-projection
**Goal:** Produce literal Text projection from eligible images.
- `never | auto | always` policy, default `auto`.
- reuse the image-description result’s text-likelihood assessment.
- dedicated `media.ocr.image` cast.
- strict literal transcription schema with image bounds/confidence.
- Media-to-Text admission adapter in wiring.
- partial-success receipts and independent retries.
**Gate:** an image has separate Media and Text projection identities; OCR citations open exact image regions.
### Phase 8 — Add agent and frontend orchestration
**Goal:** Make the three systems usable without hiding their boundaries.
- separate agent tools for Text, Structured Data, and Media;
- optional application-level parallel discovery returning partitioned results;
- source ingest status by requested projection;
- unknown-file classification dialog;
- OCR policy and cost visibility;
- refresh/retry/needs-attention actions;
- generated-description and OCR-transcription labels.
**Gate:** UI and tools never present a descriptor as source evidence or combine cross-lattice scores as if directly comparable.
### Phase 9 — Cutover, cleanup, and production proof
**Goal:** Remove transitional code after live validation.
- delete duplicate geometric code from Knowledge;
- remove compatibility adapters no longer required;
- document package/capability boundaries;
- run per-lattice scale, repair, deletion, and tenant-isolation tests;
- run mixed-ingestion end-to-end suite;
- verify cost telemetry and durable retry behavior;
- update Notion and repository architecture authorities.
**Gate:** one clean shared engine; three independently operable capabilities; no legacy dual path.
## 10. Migration sequencing dependencies
```plain text
resilient window storage
  ↓
shared lattice extraction
  ↓
Knowledge adapter
  ↓
classification coordinator
  ├── Text translators
  ├── Structured Data
  └── Media
        ↓
       OCR → Text adapter
  ↓
agent/frontend orchestration
```
Structured Data and Media can proceed independently after the shared engine and coordinator contracts stabilize. OCR depends on both Media and Text admission.
## 11. Testing strategy
### Shared engine
- differential tests against the pre-extraction Knowledge engine;
- deterministic IDs and order;
- exact versus sparse clustering;
- repair versus rebuild identity equivalence;
- descent versus exact retrieval oracle;
- vector-dimension/identity rejection;
- cancellation and budgets;
- no capability-specific payload assumptions.
### Text
- byte-identical current retrieval;
- Chat branch/turn exclusions;
- Slide ID and section order;
- OCR provenance/region citations;
- generated content exclusion.
### Structured Data
- CSV dialect and exact lexeme corpus;
- hostile/oversized CSV bounds;
- XLSX ZIP/XML hostile corpus;
- candidate-region determinism;
- hallucinated-selector rejection;
- workbook map topology;
- exact artifact read;
- separate Structured store and vector identity.
### Media
- signature-versus-extension mismatch;
- pixel/decompression limits;
- descriptor schema and grounding;
- image deduplication;
- OCR policy matrix;
- generated description never admitted to Text;
- OCR region mapping;
- provider failure and partial success.
### Security
- cross-project access failure for every table family and tool;
- parser worker has no network or credentials;
- arbitrary-URL rejection;
- prompt-injection-like source contents remain data;
- deletion/retention cascade;
- telemetry contains no source content.
## 12. Operational telemetry
Every ingestion receipt should answer:
- which source version was processed;
- which projector/policy version ran;
- which lattices were requested;
- which projections were created, reused, skipped, or failed;
- provider/model/cast and token/cost usage;
- artifact, row/cell/pixel, and output counts;
- retry/needs-attention state;
- current versus source generation.
Per-lattice health:
```plain text
source count
artifact/entry/window count
frontier/node count
dirty vs built sequence
vector identity
last rebuild/repair
retrieval latency
exact-oracle recall fixtures
ingestion spend
```
## 13. Risks and mitigations
### Risk: “generic lattice” leaks content policy
**Mitigation:** shared engine accepts opaque entries and payload refs only; capability adapters own hydration and source semantics.
### Risk: descriptors hallucinate meaning
**Mitigation:** descriptors are generated metadata with confidence/evidence; selectors and field claims are validated; original artifact is always required for grounded use.
### Risk: one source appears in multiple lattices
**Mitigation:** formal projection identities and separate persistence; one source version may emit multiple projections, but no entry belongs to multiple lattices.
### Risk: inference cost becomes invisible
**Mitigation:** durable jobs, policy-controlled casts, caching by evidence hash/model/prompt version, per-source receipts, and visible UI status.
### Risk: extracting the engine destabilizes proven KLR
**Mitigation:** characterization oracle, adapter-first migration, existing table preservation, differential tests, and no simultaneous persistence rename.
### Risk: unsafe file parsing
**Mitigation:** signature validation, isolated workers, no credentials/network, strict schemas/digests, and hard resource limits.
## 14. Final acceptance checklist
- [ ] Shared lattice engine has no Knowledge, Structured Data, Media, File, Resource, connector, provider, HTTP, or SQLite imports.
- [ ] Knowledge remains inference-free and returns exact text regions.
- [ ] Structured Data returns exact artifact payloads after descriptor discovery.
- [ ] Media returns original images after descriptor discovery.
- [ ] Text, Structured, and Media persistence are physically separate.
- [ ] Each lattice has an independent vector identity and corpus generation.
- [ ] Chat and Slides native translators have exact stable locators.
- [ ] CSV and XLSX ingest through Structured Data; XLS remains typed unsupported.
- [ ] PNG/JPEG/WebP ingest through Media.
- [ ] OCR is a separate, provenance-labeled Text projection.
- [ ] Unknown formats produce typed frontend classification choices.
- [ ] All provider work is budgeted, measured, cached, retry-bounded, and visible.
- [ ] Cross-project reads/writes fail closed.
- [ ] Existing Knowledge scale and retrieval gates remain green.
## Linked authorities
- <mention-page url="https://app.notion.com/p/3acb6410e50281d19635f051bb5ee6ad"/>
- <mention-page url="https://app.notion.com/p/3abb6410e5028179a844c0af77b21ffe"/>
- <mention-page url="https://app.notion.com/p/3abb6410e50281258d89d5719fa851fc"/>
- <mention-page url="https://app.notion.com/p/3abb6410e50281df8762c162e9a6eb13"/>
- [Current Omega Knowledge contracts](https://github.com/gccurtis/taurus-omega/blob/f621e9d7ff1c2429fd0a3f0bee3b13f04d4be927/core/capability/knowledge/knowledge.go)
- [Current Omega Intelligence contracts](https://github.com/gccurtis/taurus-omega/blob/f621e9d7ff1c2429fd0a3f0bee3b13f04d4be927/core/capability/intelligence/intelligence.go)
- [Resilient ingest design](https://github.com/gccurtis/taurus-omega/blob/f621e9d7ff1c2429fd0a3f0bee3b13f04d4be927/docs/superpowers/specs/2026-07-29-resilient-ingest-design.md)
## Current authority links
- <mention-page url="https://app.notion.com/p/3acb6410e50281bf8f16ec589da555d3"/>
- <mention-page url="https://app.notion.com/p/3acb6410e5028157b9e4e8228237cfb8"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281dfa3abd6a5ed892917"/>
- <mention-page url="https://app.notion.com/p/3acb6410e502811cb1d8d52f81f4c432">Implementation — Multi-Lattice Ingestion & Migration Plan</mention-page>
- <mention-page url="https://app.notion.com/p/3acb6410e50281d19635f051bb5ee6ad"/>


---
title: "Model — Structured Data Capability & Descriptor Lattice"
notion_page_id: "3acb6410e5028157b9e4e8228237cfb8"
notion_url: "https://app.notion.com/3acb6410e5028157b9e4e8228237cfb8"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 21:25:01Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Model — Structured Data Capability & Descriptor Lattice

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Status:** Implementation-ready Taurus Yesod authority for the Structured Data capability. V1 supports CSV and modern XLSX. Legacy binary XLS is explicitly deferred.
## 1. Product and capability contract
Structured Data makes exact tables and spreadsheet model regions discoverable without converting their full contents into text or requiring the agent to understand every value during ingestion.
The capability has two layers:
```plain text
descriptor lattice
  finds a relevant artifact

artifact store
  returns the exact table/model region or a bounded slice
```
The descriptor is generated metadata. The artifact is the source-grounded payload. An agent must never treat the descriptor as a substitute for reading the artifact when making claims about its values.
The capability is project-scoped, separately persisted, inference-assisted during ingestion, and inference-free during ordinary retrieval.
## 2. Scope
### V1 inputs
- CSV, including a declared or detected delimiter, header policy, encoding, and quote/escape policy.
- XLSX OOXML workbooks.
- Native Taurus Spreadsheet revisions when a project chooses to expose them as structured sources.
### Deferred
- legacy binary XLS;
- XLSM, XLAM, XLTM, macros, and executable workbook content;
- ODS and arbitrary database dumps;
- guaranteed execution of uploaded Excel formulas;
- chart extraction as a structured artifact;
- modifying a source through a Structured Data artifact;
- merging imported tables into an existing Taurus Spreadsheet.
## 3. Core model
```go
type StructuredSource struct {
    ID            string
    ProjectID     string
    Source        SourceVersionRef
    Format        string // csv | xlsx | taurus_spreadsheet
    PolicyVersion string
    Parser        ParserIdentity
    AddedAt       time.Time
    SyncedAt      time.Time
    Generation    int64
    Status        string
}

type StructuredArtifact struct {
    ID          string
    ProjectID   string
    SourceID    string
    Kind        StructuredArtifactKind
    ParentID    string
    Locator     StructuredLocator
    Payload     StructuredPayloadRef
    ContentHash string
    Shape       TableShape
    Descriptor  StructuredDescriptor
    CreatedAt   time.Time
}

type StructuredArtifactKind string

const (
    ArtifactTable       StructuredArtifactKind = "table"
    ArtifactModelRegion StructuredArtifactKind = "model_region"
    ArtifactWorksheet   StructuredArtifactKind = "worksheet"
    ArtifactWorkbook    StructuredArtifactKind = "workbook"
)
```
`ArtifactTable` is a rectangular dataset. `ArtifactModelRegion` may contain assumptions, calculations, or outputs that are spatially meaningful but not a conventional relational table. `ArtifactWorksheet` and `ArtifactWorkbook` are parent maps whose descriptors help find and explain child artifacts; their payloads may be manifests rather than duplicated cells.
### 3.1 Locators
```go
type StructuredLocator struct {
    Kind       string // csv_rows | xlsx_range | spreadsheet_range | workbook
    FileID     string
    SheetName  string
    SheetIndex int
    Range      string // source A1 range for provenance, never Taurus identity
    RowStart   int64
    RowEnd     int64
    ByteStart  int64
    ByteEnd    int64
}
```
For a native Taurus Spreadsheet, retain stable RowIDs, ColumnIDs, CellIDs, and the exact source revision in an additional stable-selector field. A1 is display/provenance only.
### 3.2 Payloads
```go
type StructuredPayloadRef struct {
    StorageKind string // inline | chunked_ndjson | arrow | parquet | native
    ManifestURI string
    SchemaHash  string
    ByteSize    int64
    RowCount    int64
    ColumnCount int64
}
```
The logical contract is “the full artifact is retrievable.” Physical storage may be chunked. Small artifacts can be returned whole; large artifacts are read through selectors and pages.
Exact values remain exact:
- preserve original CSV lexemes;
- retain leading-zero identifiers as text;
- avoid `float64` for exact decimals;
- record null versus empty string;
- preserve XLSX formula source and cached result separately;
- retain original source coordinates.
## 4. Descriptor model
```go
type StructuredDescriptor struct {
    Name          string
    Summary       string
    Purpose       string
    Grain         string
    Entities      []string
    TimeCoverage  *TimeCoverage
    Columns       []ColumnDescriptor
    Tags          []StructuredTag
    Relationships []RelationshipCandidate
    Roles         []RoleCandidate
    Confidence    float32
    Status        DescriptorStatus
    Evidence      []StructuredEvidenceRef
    Provenance    DescriptorProvenance
}

type ColumnDescriptor struct {
    SourceName   string
    DisplayName  string
    PhysicalType string
    SemanticType string
    Role         string
    Description  string
    Nullable     bool
}

type StructuredTag struct {
    Namespace  string
    Value      string
    Origin     string // deterministic | inferred | user
    Confidence float32
}

type DescriptorStatus string

const (
    DescriptorMachine  DescriptorStatus = "machine"
    DescriptorVerified DescriptorStatus = "verified"
    DescriptorUser     DescriptorStatus = "user"
)
```
Suggested tag namespaces:
```plain text
kind:table
domain:finance
topic:revenue
role:model_input
grain:customer_month
entity:customer
time:monthly
source:xlsx
```
User edits outrank inferred descriptor fields. A source refresh preserves verified/user metadata when its evidence targets still resolve; otherwise it marks the field stale for review rather than silently attaching it to different content.
## 5. CSV ingestion
CSV is normally one table artifact:
```plain text
authorized CSV snapshot
  → bounded decoding and dialect detection
  → exact row/field parse
  → schema/profile construction
  → one descriptor inference
  → validated table artifact
  → descriptor embedding and lattice publication
```
### 5.1 Deterministic extraction
Record:
- encoding;
- separator;
- quoting and escaping;
- header decision;
- row-width consistency;
- original field lexemes;
- normalized typed values;
- parser diagnostics;
- row/column counts and bounds;
- byte/line locators where possible.
Type inference is a candidate interpretation. The original lexeme is always retained.
```go
type CSVParsePolicy struct {
    MaxBytes       int64
    MaxRows        int64
    MaxColumns     int
    MaxFieldBytes  int64
    AllowedEncoding []string
    HeaderPolicy   string // auto | present | absent
}
```
### 5.2 Descriptor input
The inference model receives a bounded card:
```go
type TableCard struct {
    SourceLabel     string
    CandidateName   string
    Columns         []ColumnProfile
    Representative []SampleRow
    RowCount        int64
    ParseNotes      []string
}
```
Representative samples should cover common and unusual row shapes without sending the entire file. Sensitive-column policy may allow schema and profiles while forbidding raw samples.
### 5.3 Descriptor result
The model returns structured JSON only:
```json
{
  "name": "Monthly customer revenue",
  "summary": "Recognized revenue by customer and month.",
  "purpose": "Historical revenue analysis and forecast comparison.",
  "grain": "one row per customer per month",
  "entities": ["customer", "month"],
  "tags": [
    {"namespace": "domain", "value": "finance"},
    {"namespace": "topic", "value": "revenue"}
  ],
  "columns": [
    {
      "sourceName": "customer_id",
      "semanticType": "identifier",
      "role": "dimension",
      "description": "Stable customer identifier."
    }
  ],
  "confidence": 0.89
}
```
Validation rejects invented columns and unsupported type claims. Uncertainty is retained rather than repaired with another invented answer.
## 6. XLSX ingestion
XLSX parsing should reuse the safe worker and contracts selected by <mention-page url="https://app.notion.com/p/3acb6410e5028182b958fcd202736a6c"/>, while producing Structured Data artifacts rather than committed Spreadsheet resources.
### 6.1 Separation from import
```plain text
XLSX import
  parses → maps → creates editable Taurus Spreadsheets

XLSX structured ingestion
  parses → discovers regions → stores exact artifacts + descriptors
```
The parser worker may be shared. Authorization, result mapping, storage, IDs, and outcome remain separate.
### 6.2 Safe extraction
Use Excelize in a short-lived, resource-limited Go worker. The worker receives an attempt-local source and emits:
- workbook manifest;
- worksheet metadata;
- row-major cell chunks;
- formulas and cached values;
- named ranges and named tables;
- merged regions;
- panes, hidden state, and limited formatting signals;
- embedded image references for separate Media admission;
- diagnostics.
The worker has no database credentials, connector credentials, network access, project authority, or canonical IDs. Go validates every output digest, size, count, URI, schema version, and source selector.
### 6.3 Candidate region detection
The deterministic analyzer proposes regions using:
1. explicit Excel tables;
2. named ranges;
3. connected non-empty cell regions;
4. blank-row/column boundaries;
5. repeated header/type structure;
6. formula-family continuity;
7. dependency edges;
8. nearby labels and merged headings;
9. formatting boundaries as weak evidence.
```go
type CandidateRegion struct {
    ID              string
    SheetName       string
    Selector        CellRange
    NearbyLabels    []LabeledCell
    Columns         []ColumnProfile
    FormulaFamilies []FormulaFamily
    Incoming        []DependencyEdge
    Outgoing        []DependencyEdge
    Samples         []SampleRow
    StructuralHints []string
}
```
The system does not require every region to be a table. Calculation blocks and assumption panels can remain `model_region`.
### 6.4 Reasoning call
A bounded reasoning cast receives candidate-region cards and may:
- accept a candidate;
- reject noise;
- split a candidate by returning valid subranges;
- combine adjacent/related candidates;
- name and describe the resulting artifact;
- assign structural and semantic roles;
- identify the artifact grain;
- describe relationships and dependencies;
- produce tags and confidence.
It returns selectors, never copied cell matrices:
```json
{
  "artifacts": [
    {
      "kind": "model_region",
      "name": "Revenue assumptions",
      "summary": "Monthly price, volume, and churn assumptions feeding the forecast.",
      "regions": [
        {"sheet": "Assumptions", "range": "B7:N28"}
      ],
      "roles": ["model_input", "assumption", "driver"],
      "tags": ["revenue", "forecast", "monthly"],
      "confidence": 0.94
    }
  ]
}
```
Go verifies:
- every sheet and range exists;
- ranges remain within admitted limits;
- combined regions belong to the same authorized source;
- column references resolve;
- formula/dependency statements match extracted evidence;
- no output contains source bytes outside the requested selectors.
### 6.5 Workbook map
Create a workbook-level descriptor that summarizes artifact topology:
```go
type WorkbookMap struct {
    ArtifactID   string
    Name         string
    Summary      string
    Children     []ArtifactLink
    Dependencies []ArtifactDependency
}
```
The workbook map helps an agent discover the model as a whole. It does not duplicate every child cell.
## 7. Native Taurus Spreadsheet projection
A native Spreadsheet needs no file parser. The projector reads an authorized exact revision through a narrow port:
```go
type SpreadsheetSnapshotReader interface {
    SnapshotForStructuredIngestion(
        ctx context.Context,
        scope Scope,
        spreadsheetID string,
        atRevision int64,
    ) (SpreadsheetStructuredSnapshot, error)
}
```
The snapshot exposes:
- stable row, column, cell, and named-range identities;
- canonical values;
- formula source and dependencies;
- formula families;
- overlays only as source references;
- exact revision and content hashes.
The Structured Data capability owns its derived artifacts. It does not import the Spreadsheet service package; wiring provides the adapter.
## 8. Search and read
```go
type StructuredSearchRequest struct {
    Query       string
    Tags        []TagFilter
    SourceIDs   []string
    Kinds       []StructuredArtifactKind
    TopK        int
}

type StructuredMatch struct {
    ArtifactID  string
    Name        string
    Summary     string
    Tags        []StructuredTag
    Shape       TableShape
    Locator     StructuredLocator
    Relevance   float64
    Confidence  float32
}

type StructuredReadRequest struct {
    ArtifactID string
    Selector   ArtifactSelector
    Limit      ReadLimit
}
```
`Search` fuses:
- descriptor-vector relevance within the Structured Data lattice;
- exact source, sheet, column, and tag matches;
- verified/user descriptor preference;
- artifact-kind filters.
`Read` returns exact artifact content:
- whole payload for bounded small artifacts;
- selected columns/rows/range;
- paginated rows;
- a schema and preview;
- formula/dependency metadata for model regions.
The capability may later expose deterministic filter/aggregate/query operations. V1 does not need to understand or summarize the table at query time merely to hand the artifact to an agent.
## 9. Refresh and generation
```go
type StructuredGeneration struct {
    ProjectID     string
    Generation    int64
    VectorIdentity VectorIdentity
    PolicyVersion string
    BuiltAt       time.Time
}
```
Refresh:
1. obtains the new exact source version;
2. deterministically re-extracts it;
3. reuses artifacts whose selector content hash is unchanged;
4. reuses descriptors whose evidence hash and policy/model identity are unchanged;
5. regenerates only changed descriptors;
6. embeds only changed descriptor entries;
7. publishes artifacts, descriptors, and lattice generation atomically.
Until publication succeeds, retrieval uses the prior coherent generation. Staleness is visible through source-versus-projection version metadata.
## 10. Persistence
Recommended table families:
```plain text
structured_data_sources
structured_data_artifacts
structured_data_artifact_parts
structured_data_descriptors
structured_data_tags
structured_data_relations
structured_data_ingestion_attempts

structured_lattice_entries
structured_lattice_nodes
structured_lattice_memberships
structured_lattice_level_indexes
structured_lattice_generations
```
Required invariants:
- project scope on every key and query;
- unique source origin/version/policy admission;
- unique artifact identity within one source generation;
- immutable content hash per artifact version;
- descriptor provenance and evidence hashes;
- no foreign key into Text or Media lattice tables;
- atomic generation publication;
- cascading derived-data deletion when source authority removes admission.
## 11. Intelligence casts
```plain text
reasoning / purpose: structured_data.describe.csv
reasoning / purpose: structured_data.describe.workbook
reasoning / purpose: structured_data.describe.region
embedding / purpose: structured_data.index
```
The capability asks for semantic casts and never names a provider or model. Descriptor prompts are versioned. Every result records resolved provider/model identity and usage.
CSV may use inference rather than reasoning when the bounded table card is simple. Workbook region composition should use reasoning because split/merge/topology decisions require more deliberate analysis.
## 12. APIs and agent functions
```plain text
POST   /structured-data/ingestions
GET    /structured-data/ingestions/{id}
GET    /structured-data/artifacts
GET    /structured-data/artifacts/{id}
POST   /structured-data/search
POST   /structured-data/artifacts/{id}/read
POST   /structured-data/sources/{id}/refresh
DELETE /structured-data/sources/{id}
```
Agent tools:
```plain text
structured.search
structured.inspect
structured.read
structured.list
```
Tool schemas require project scope from the execution context, never from model-supplied arguments.
## 13. Cost, limits, and operational behavior
- Descriptor inference scales with candidate regions, not rows or cells.
- Cache on source/region evidence hash, policy version, and model identity.
- Batch region cards where the provider and schema permit it.
- Restrict model samples according to privacy policy.
- Apply file, decompression, worksheet, row, column, cell, formula, sample, output, token, time, memory, and artifact-count limits.
- Durable retries honor provider retry information and stop in `needs_attention`.
- No source or worksheet is silently skipped; receipts contain created, reused, skipped, and failed artifacts with typed reasons.
## 14. Acceptance evidence
- A CSV with quoted delimiters, empty strings, null candidates, leading-zero identifiers, and exact decimals round-trips through artifact reads.
- A CSV descriptor cannot add a nonexistent column.
- An XLSX with multiple datasets creates validated child artifacts and a workbook map.
- An XLSX model region preserves formula source, cached values, and source coordinates without executing macros.
- An inference response naming a nonexistent range is rejected.
- A structured search never loads Text or Media nodes.
- Reading an artifact returns exact values rather than the descriptor’s paraphrase.
- Re-ingesting an unchanged file reuses artifacts, descriptors, vectors, and generation content.
- Deleting a source removes its artifacts and Structured lattice entries without touching another lattice.
## Sources
- <mention-page url="https://app.notion.com/p/3abb6410e5028179a844c0af77b21ffe"/>
- <mention-page url="https://app.notion.com/p/3acb6410e5028182b958fcd202736a6c"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281d19635f051bb5ee6ad"/>
- [Current Omega Knowledge lattice contracts](https://github.com/gccurtis/taurus-omega/blob/f621e9d7ff1c2429fd0a3f0bee3b13f04d4be927/core/capability/knowledge/knowledge.go)
## Current authority links
- <mention-page url="https://app.notion.com/p/3acb6410e50281bf8f16ec589da555d3"/>
- <mention-page url="https://app.notion.com/p/3acb6410e5028157b9e4e8228237cfb8">Model — Structured Data Capability & Descriptor Lattice</mention-page>
- <mention-page url="https://app.notion.com/p/3acb6410e50281dfa3abd6a5ed892917"/>
- <mention-page url="https://app.notion.com/p/3acb6410e502811cb1d8d52f81f4c432"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281d19635f051bb5ee6ad"/>


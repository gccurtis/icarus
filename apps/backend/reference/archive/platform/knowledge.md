# Platform — Icarus Knowledge Runtime Model

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e50281e6a3faec60f5b0aefb).

## Summary / Concept
<callout icon="🧭" color="blue_bg">
	**Build position:** Resources 1 of 4. Knowledge follows the Foundation services—especially Intelligence and Context—and supplies grounded retrieval to Document, Slides, Spreadsheet, Research, and other callers.
</callout>
### Prerequisites
- Platform Intelligence provides the embedding interface.
- Platform database support provides a configuration-scoped `KnowledgeStore`.
- Platform logging records ingest, retrieval, usage, and failures.
### Integration gate
- Context provides the resource-resolver seam required by Context-scoped retrieval.
### Concept
Knowledge is the grounded retrieval platform. It admits source text, creates overlapping windows, embeds those windows, builds a hierarchical lattice, and returns verbatim source regions ranked by relevance.
Knowledge supplies retrieval. Intelligence consumes those regions when synthesis or reasoning is required.
It lives at:
```plain text
apps/backend/src/0-platform/knowledge/
```
### Repository state
Implemented in the pushed repository:
- Configuration-scoped SQLite store
- Source registry
- Text windowing
- Streaming windowing component
- Batched embedding through Intelligence
- Source-tier and corpus-tier lattice construction
- Exact and sparse clustering paths
- Stored frontier and level indices
- Best-first descent
- Region assembly
- Source add, remove, and list
- Single-query retrieval
- Intelligence tool adapter
- Logging and usage accounting
Required Context seam:
- Retrieval accepts an optional set of `ContextEntry` values.
- Context entries resolve once into admissible source IDs.
- Knowledge performs its normal lattice descent.
- Retrieved windows are filtered by admissible source ID before region assembly.
- Retrieval returns a scope manifest alongside regions.
- Batched retrieval reuses one resolved scope across all queries.
### Repository placement
```plain text
apps/backend/src/
  0-platform/
    knowledge/
      embedder.ts
      knowledge.ts
      store.ts
      types.ts
      windowing/
      lattice/
        cluster.ts
        descent.ts
        knn.ts
        regions.ts
        repair.ts

    database/
      knowledge-store.ts

  1-init/
    create/
      knowledge.ts
```
Knowledge is an in-process platform service. Capabilities call the bound instance directly.
### Runtime ownership
- Invocation: in-process through `Knowledge`
- Persistence: configuration-scoped `KnowledgeStore`
- Embeddings: Platform Intelligence
- Retrieval output: verbatim `Region` values
- HTTP and queues: owned by calling capabilities
- Context resolution: injected structural seam
## Types & Interfaces
### Source model
```typescript
interface SourceRecord {
  sourceId: string;
  label: string;
  revision: string;
  windowCount: number;
  sizeBytes: number;
  addedAt: Date;
  syncedAt: Date;
}
```
- `sourceId` is a stable caller-owned identity.
- `label` identifies the source kind.
- `revision` is the caller-supplied change token.
- Matching revisions allow ingest to return without embedding work.
- Source text is stored in windows; the registry stores source metadata.
### Window model
```typescript
interface KnowledgeWindow {
  id: string;
  sourceId: string;
  label: string;
  ordinal: number;
  start: number;
  end: number;
  text: string;
  embedding: number[];
}
```
A window is the smallest retrievable lattice artifact.
- `id` is content-addressed from source identity and text.
- `ordinal` records source order.
- `start` and `end` are the positional offsets produced by the windowing layer.
- `text` is retained verbatim.
- `embedding` is unit-normalized.
- `label` is denormalized for region construction.
The persistence columns are currently named `start_byte` and `end_byte`; they store the offsets supplied by windowing.
### Node model
```typescript
interface KnowledgeNode {
  id: string;
  sourceId?: string;
  level: number;
  centroid: number[];
  count: number;
  cohesion: number;
  memberIds: string[];
}
```
A node is a derived cluster artifact.
- Source-tier nodes carry `sourceId`.
- Corpus-tier nodes span the configuration-scoped corpus.
- Members can be windows or lower-level nodes.
- Centroids are unit-normalized means.
- Cohesion records the weakest pairwise similarity within the clique.
- Member IDs keep expansion bounded and store-independent.
Window IDs and node IDs use distinct prefixes, allowing descent to identify artifact type without a store lookup.
### Frontier and stored level index
```typescript
interface FrontierEntry {
  id: string;
  vector: number[];
  isWindow: boolean;
}

interface StoredLevelIndex {
  level: number;
  threshold: number;
  k: number;
  basis: number[][];
  centroids: number[][];
  artifacts: StoredArtifactEntry[];
}
```
The frontier is the entry surface for corpus descent. A stored level index contains PCA projection data, IVF centroids, cell assignments, and exact reranked neighbor edges.
These are derived indices: they accelerate lattice traversal and can be rebuilt from persisted windows and source metadata. They are not a separate capability.
### Ingest model
```typescript
interface AddItem {
  sourceId: string;
  label: string;
  revision?: string;
  text?: string;
  stream?: ReadableStream<string>;
}

interface AddResult {
  sourceId: string;
  skipped: boolean;
  windowsAdded: number;
  windowsReused: number;
  usage: Usage;
}
```
Ingest flow:
1. Read text or stream input.
2. Compare the supplied revision with the source registry.
3. Window the text.
4. Reuse embeddings for matching content-addressed windows.
5. Embed changed windows in batches.
6. Replace source windows.
7. Rebuild the source-tier lattice.
8. Repair or rebuild the corpus tier.
9. Persist the source record.
### Region model
```typescript
interface Region {
  sourceId: string;
  label: string;
  start: number;
  end: number;
  text: string;
  relevance: number;
  density: number;
}

interface RetrieveResult {
  regions: Region[];
  usage: Usage;
}
```
Overlapping or touching windows from one source merge into a contiguous Region. `relevance` is the best covering window score. `density` is the number of retrieved windows covering the span. Region text remains verbatim.
### Embedder seam
```typescript
interface Embedder {
  embed(
    inputs: string[]
  ): Promise<{ vectors: number[][]; usage: Usage }>;
}
```
`IntelligenceEmbedder` adapts Platform Intelligence to this interface. Knowledge remains provider-independent.
### Store interface
```typescript
interface KnowledgeStore {
  getSource(sourceId: string): Promise<SourceRecord | undefined>;
  putSource(record: SourceRecord): Promise<void>;
  deleteSource(sourceId: string): Promise<void>;
  listSources(): Promise<SourceRecord[]>;

  getWindows(ids: string[]): Promise<KnowledgeWindow[]>;
  putWindows(windows: KnowledgeWindow[]): Promise<void>;
  deleteWindowsForSource(sourceId: string): Promise<void>;

  getNodes(ids: string[]): Promise<KnowledgeNode[]>;
  putNodes(nodes: KnowledgeNode[]): Promise<void>;
  deleteNodesForSource(sourceId: string): Promise<void>;
  deleteCorpusNodes(): Promise<void>;
  getSourceNodeIds(sourceId: string): Promise<string[]>;

  getFrontier(): Promise<FrontierEntry[]>;
  putFrontier(entries: FrontierEntry[]): Promise<void>;

  getLevelIndex(level: number): Promise<StoredLevelIndex | undefined>;
  putLevelIndex(index: StoredLevelIndex): Promise<void>;
  deleteLevelIndex(): Promise<void>;
}
```
The store instance carries configuration scope, keeping it out of method signatures and model artifacts.
## Runtime Objects
### Construction
```typescript
const store = createKnowledgeStoreFromRuntimeConfig(config, database);
const knowledge = createKnowledge({
  store,
  embedder: new IntelligenceEmbedder(intelligence),
  resourceResolver: contextResourceResolver,
  logger,
});
```
The store and resolver are bound once during initialization. Project scope comes from the top-level runtime configuration and is not carried through Knowledge values or method parameters.
### Windowing
Two entry forms produce the same window model:
- `windowText(text, options)` performs a single-pass split.
- `StreamWindower` accepts chunks and emits completed windows while retaining only its overlap state.
```typescript
interface WindowOptions {
  targetRunes: number;
  overlapRunes: number;
}
```
Windows preserve source order and carry overlapping trailing material to reduce boundary loss.
### Lattice model
Each source builds a forest of overlapping maximal-clique clusters. Source frontiers then feed the corpus tier.
For pools up to the configured crossover, clustering uses an exact pairwise cosine matrix. Larger pools use:
1. PCA projection
2. IVF cell assignment
3. Candidate search across nearby cells
4. Exact full-dimensional reranking
5. Symmetric neighbor graph construction
6. Maximal-clique clustering
PCA guides candidate selection. Stored similarities and final ranking use full embedding dimensions.
```typescript
interface KNNConfig {
  k: number;
  pcaDims: number;
  cells?: number;
  maxClusterPool: number;
  repairMaxFraction: number;
  repairMaxDrift: number;
}
```
### Retrieval model
Normal retrieval:
1. Embed the query.
2. Load the corpus frontier.
3. Use the stored level index when available to narrow frontier candidates.
4. Run best-first descent with configured beam, similarity threshold, and expansion limits.
5. Collect candidate window IDs and similarity scores.
6. Load the candidate windows.
7. Merge overlapping or touching windows from the same source.
8. Rank and admit regions under the configured character budget.
An empty descent result returns an empty region list.
### Context-scoped retrieval
```typescript
interface ContextEntry {
  readonly id: string;
  readonly kind: string;
}

interface KnowledgeResourceResolver {
  resolve(
    entries: readonly ContextEntry[]
  ): Promise<readonly ContextEntry[]>;
}

interface KnowledgeRetrievalOptions {
  readonly topK?: number;
  readonly scope?: readonly ContextEntry[];
}

interface KnowledgeScopeManifest {
  readonly inputEntries: readonly ContextEntry[];
  readonly resolvedEntries: readonly ContextEntry[];
  readonly resolvedSourceIds: readonly string[];
  readonly contextDigest: string;
  readonly scopeDigest: string;
  readonly resolvedAt: string;
}

interface ScopedRetrieveResult {
  readonly regions: readonly Region[];
  readonly scope: KnowledgeScopeManifest | null;
  readonly usage: Usage;
}
```
Scoped retrieval follows the normal retrieval path and filters after descent:
1. Resolve the input entries once.
2. Canonically deduplicate and sort the resolved entries.
3. Build `admissibleSourceIds`.
4. Execute normal lattice descent.
5. Load the candidate windows.
6. Retain windows whose `sourceId` is admissible.
7. Assemble regions from the retained windows.
8. Return the exact scope manifest with the result.
An absent or empty scope searches the entire configuration-scoped lattice.
The source ID is the authoritative membership key. Entry kind guides Context resolution and provenance.
## Change Operations
<table fit-page-width="true" header-row="true">
<tr>
<td>Operation</td>
<td>Canonical effect</td>
<td>Derived effect</td>
<td>Idempotency or conflict rule</td>
</tr>
<tr>
<td>`source.add`</td>
<td>Insert or replace the source record and its verbatim windows.</td>
<td>Build the source lattice, repair or rebuild the corpus tier, frontier, and level index.</td>
<td>A matching caller-supplied revision skips ingest; content-addressed windows reuse embeddings.</td>
</tr>
<tr>
<td>`source.remove`</td>
<td>Delete the source record and cascade its windows.</td>
<td>Remove source nodes and repair or rebuild corpus traversal artifacts.</td>
<td>Removing an absent source completes without inventing state.</td>
</tr>
<tr>
<td>`derived.rebuild`</td>
<td>No canonical source or window change.</td>
<td>Rebuild nodes, frontier, and level indices from canonical material.</td>
<td>Equivalent canonical inputs produce equivalent traversal state.</td>
</tr>
</table>
Knowledge does not use capability ChangeSets. Its canonical mutation boundary is the configuration-scoped store transaction; nodes, frontier entries, and level indices are replaceable derivatives.
## Endpoints
### In-process service surface
```typescript
class Knowledge {
  add(item: AddItem): Promise<AddResult>;
  remove(sourceId: string): Promise<void>;
  listSources(): Promise<SourceRecord[]>;

  retrieve(
    query: string,
    options?: KnowledgeRetrievalOptions
  ): Promise<ScopedRetrieveResult>;

  retrieveMany(
    queries: readonly string[],
    options?: KnowledgeRetrievalOptions
  ): Promise<readonly ScopedRetrieveResult[]>;

  searchTool(): ToolBinding;
}
```
`retrieveMany` batches query embedding where possible, resolves scope once, and returns one result per query.
The search tool wraps `retrieve` for Intelligence calls and returns verbatim regions.
The service surface is the endpoint boundary for callers inside the backend. HTTP endpoints remain capability-owned.
## Jobs
<table fit-page-width="true" header-row="true">
<tr>
<td>Endpoint or intent</td>
<td>Runtime call</td>
<td>Queue</td>
<td>Response mode</td>
<td>Writes or emitted changes</td>
<td>Calls</td>
</tr>
<tr>
<td>Capability-owned source ingest</td>
<td>`Knowledge.add`</td>
<td>Serial</td>
<td>Inline `AddResult`</td>
<td>Source registry, windows, source lattice, corpus repair/frontier, and level index</td>
<td>Intelligence embedding and `KnowledgeStore`</td>
</tr>
<tr>
<td>Capability-owned source removal</td>
<td>`Knowledge.remove`</td>
<td>Serial</td>
<td>Inline completion</td>
<td>Removes the source and its canonical windows; repairs or rebuilds derived lattice state</td>
<td>`KnowledgeStore`</td>
</tr>
<tr>
<td>Capability-owned source listing</td>
<td>`Knowledge.listSources`</td>
<td>Concurrent</td>
<td>Inline source records</td>
<td>None</td>
<td>`KnowledgeStore`</td>
</tr>
<tr>
<td>Capability-owned retrieval</td>
<td>`Knowledge.retrieve`</td>
<td>Concurrent</td>
<td>Inline scoped regions</td>
<td>None</td>
<td>Context resolver, Intelligence embedding, lattice descent, and `KnowledgeStore`</td>
</tr>
<tr>
<td>Capability-owned batched retrieval</td>
<td>`Knowledge.retrieveMany`</td>
<td>Concurrent</td>
<td>Inline ordered results</td>
<td>None</td>
<td>One resolved scope, batched Intelligence embedding, lattice descent, and `KnowledgeStore`</td>
</tr>
<tr>
<td>Intelligence tool invocation</td>
<td>`Knowledge.searchTool` → `retrieve`</td>
<td>Inherits the calling job</td>
<td>Verbatim regions to the tool caller</td>
<td>None</td>
<td>Same retrieval path</td>
</tr>
</table>
Knowledge does not register product HTTP routes. Calling capabilities own request decoding and job creation; their mapper fixes the queue before invoking this service. Mutation calls use the serial path, while read-only retrieval uses the bounded concurrent path.
## SQL Tables
### Logical schema and indexes
Capability documentation uses logical table names. The SQLite adapter maps them to configuration-bound physical names before applying migrations or queries.
```sql
CREATE TABLE knowledge_sources (
  source_id    TEXT PRIMARY KEY CHECK (length(source_id) > 0),
  label        TEXT NOT NULL CHECK (length(label) > 0),
  revision     TEXT NOT NULL DEFAULT '',
  window_count INTEGER NOT NULL DEFAULT 0 CHECK (window_count >= 0),
  size_bytes   INTEGER NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  added_at     TEXT NOT NULL,
  synced_at    TEXT NOT NULL
);

CREATE TABLE knowledge_windows (
  id         TEXT PRIMARY KEY CHECK (length(id) > 0),
  source_id  TEXT NOT NULL,
  label      TEXT NOT NULL CHECK (length(label) > 0),
  ordinal    INTEGER NOT NULL CHECK (ordinal >= 0),
  start_byte INTEGER NOT NULL CHECK (start_byte >= 0),
  end_byte   INTEGER NOT NULL CHECK (end_byte >= start_byte),
  text       TEXT NOT NULL,
  embedding  TEXT NOT NULL CHECK (json_valid(embedding)),
  UNIQUE (source_id, ordinal),
  FOREIGN KEY (source_id)
    REFERENCES knowledge_sources(source_id) ON DELETE CASCADE
);

CREATE INDEX knowledge_windows_source_order
  ON knowledge_windows(source_id, ordinal, id);

CREATE TABLE knowledge_nodes (
  id         TEXT PRIMARY KEY CHECK (length(id) > 0),
  source_id  TEXT,
  level      INTEGER NOT NULL CHECK (level >= 0),
  centroid   TEXT NOT NULL CHECK (json_valid(centroid)),
  count      INTEGER NOT NULL CHECK (count >= 1),
  cohesion   REAL NOT NULL CHECK (cohesion >= -1.0 AND cohesion <= 1.0),
  member_ids TEXT NOT NULL
    CHECK (json_valid(member_ids) AND json_type(member_ids) = 'array'),
  FOREIGN KEY (source_id)
    REFERENCES knowledge_sources(source_id) ON DELETE CASCADE
);

CREATE INDEX knowledge_nodes_source_level
  ON knowledge_nodes(source_id, level, id);

CREATE INDEX knowledge_nodes_level
  ON knowledge_nodes(level, id);

CREATE TABLE knowledge_frontier (
  id        TEXT PRIMARY KEY CHECK (length(id) > 0),
  vector    TEXT NOT NULL CHECK (json_valid(vector)),
  is_window INTEGER NOT NULL CHECK (is_window IN (0, 1))
);

CREATE TABLE knowledge_level_indices (
  level INTEGER PRIMARY KEY CHECK (level >= 0),
  data  TEXT NOT NULL CHECK (json_valid(data))
);
```
## Appendices
### Canonical and derived persistence
- Source record: canonical ingest registry.
- Window text and embedding: canonical retrievable material.
- Lattice node: derived cluster structure.
- Frontier: derived descent entry index.
- Level index: derived PCA and IVF acceleration index.
This distinction allows lattice and search structures to be rebuilt while preserving source identities, text, and embeddings.
### Invariants
1. Every returned region is a verbatim span from stored windows.
2. Source revisions control ingest skipping.
3. Matching windows reuse embeddings.
4. Embeddings and node centroids are unit-normalized.
5. Lattice nodes reference members by stable ID.
6. Scoped retrieval filters candidate windows after normal descent and before region assembly.
7. Every scoped result records the exact resolved scope.
8. Equivalent scope sets produce the same scope digest.
9. Intelligence is the only model-provider dependency.
10. The configuration-scoped store is the persistence boundary.

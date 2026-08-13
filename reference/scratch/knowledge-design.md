# Icarus Knowledge Platform — Design Draft (rev 3)

## What it does

Knowledge is the grounded retrieval layer. You give it sources (text, streams),
it windows and embeds them, clusters the windows into a lattice, and answers
queries with verbatim cited spans. It never synthesizes — that is Intelligence's
job.

---

## Project isolation and the store

Project isolation is enforced at the store level, not inside the Knowledge
object. Before `Knowledge` is constructed, `resolveKnowledgeStore(projectId)`
derives the project-specific SQLite table names from the project ID and returns
a `KnowledgeStore` scoped to exactly that project. No project ID is ever
stored on the Knowledge object, or on any artifact inside it — the store IS the
scope.

```ts
// Called once at project initialization:
const store = resolveKnowledgeStore(projectId, db);  // tables named after projectId
const knowledge = createKnowledge(store, intelligence, opts);
```

`Knowledge` constructor:
```ts
class Knowledge {
  constructor(store: KnowledgeStore, embedder: Embedder, opts?: KnowledgeOptions)
}
```

Capabilities receive the already-scoped `Knowledge` object and call methods
directly — no ID argument anywhere in capability code.

---

## Why async?

Embedding is a network call to OpenRouter — there is no way to make it
synchronous. Any operation that embeds (all of `add`, `addStream`, `retrieve`,
`retrieveMany`) must be async because of that call. SQLite reads/writes use
`better-sqlite3` which is synchronous; only the embedding boundary is async.

The `AbortSignal` parameter on `intelligence.embed(signal, ...)` is optional
cancellation plumbing. We pass `undefined` in the embedder wrapper for now —
it is there so we can wire request cancellation later without changing the
interface.

---

## Source model and registry

A source is text admitted to the lattice. The registry records that it exists,
at what revision, when — **never the text itself**.

```ts
interface SourceRecord {
  sourceId: string;    // stable caller ID — e.g. "doc:9f2c", "/reports/q2.md"
  label: string;       // kind: "document", "webpage", "note", "attachment"
  revision: string;    // caller-controlled version string — could be a hash,
                       // an updated_at timestamp, a commit SHA, anything stable.
  windowCount: number;
  sizeBytes: number;
  addedAt: Date;
  syncedAt: Date;
}
```

**One field, one purpose.** `revision` is the single change-detection token.
There is no separate `contentHash`. The caller decides what `revision` is: if
they want it to be a hash of the content, they hash it before calling `add`.
Knowledge does not hash content itself — it would have to hash it as it
streams, before knowing whether the whole stream is available, which adds
complexity for no benefit. The caller already knows what changed.

On re-add: if `revision` matches the stored record, the source is skipped with
zero embedding calls. If it differs, changed windows (by content-addressed
window ID) are re-embedded; unchanged windows reuse stored vectors.

---

## Window

A Window is a text chunk plus its embedding. It is the base artifact of the
lattice. Windows carry enough information to build a Region without any
additional lookup — the source `label` is denormalized onto the window so
retrieval is O(1) from window to source type.

```ts
interface Window {
  id: string;        // SHA-256(text) — content-addressed; same text = same ID
  sourceId: string;
  label: string;     // copied from SourceRecord at ingest — no secondary lookup needed
  ordinal: number;   // position in source, 0-based
  start: number;     // UTF-16 code-unit offset in source at index time
  end: number;       // UTF-16 code-unit offset, exclusive
  text: string;      // stored verbatim — retrieval never reopens the source
  embedding: number[]; // unit-normalized
}
```

---

## Node

A Node is a cluster artifact. It holds the IDs of its members (windows or
lower-level nodes) and a centroid vector (unit-normalized mean of member
embeddings). Members are loaded on-demand during descent — never pre-loaded —
so memory is bounded to one expansion's worth of children at a time.

Nodes carry no project ID. The store is already project-scoped.

```ts
interface Node {
  id: string;          // SHA-256(sorted memberIds) — deterministic
  sourceId?: string;   // set for source-tier nodes; absent = corpus tier
  level: number;
  centroid: number[];  // unit-normalized mean — used for scoring in descent
  count: number;       // === memberIds.length
  cohesion: number;    // weakest pairwise similarity in the clique
  memberIds: string[]; // window IDs or lower-node IDs
}
```

Window ↔ Node relationship: a Node's `memberIds` are a mix of window IDs and
lower node IDs. The store provides O(1) batch lookup by ID for both. A Node
never holds Window objects inline — it holds IDs, and descent fetches the
next level on demand.

---

## Ingest API

```ts
interface AddItem {
  sourceId: string;
  label: string;
  revision?: string;  // omit to force full re-ingest
  text?: string;
  stream?: ReadableStream<string>;
}

interface AddResult {
  sourceId: string;
  skipped: boolean;      // revision matched — nothing changed, no tokens spent
  windowsAdded: number;
  windowsReused: number; // unchanged windows whose stored embedding was reused
  usage: Usage;          // embedding tokens spent (0 when skipped)
}
```

```ts
add(item: AddItem): Promise<AddResult>
addStream(item: AddItem): Promise<AddResult>
```

Batching is internal: all changed windows from a call are passed as a single
`string[]` to the embedder. No public batch API.

---

## Windowing

Two implementations, byte-identical output for the same input:

**`windowText(text, opts)`** — single-pass, produces all windows at once.

**`StreamWindower`** — state machine; `write(chunk)` emits completed windows
per chunk; `close()` flushes the tail. Used by `addStream` so a file is never
fully in memory.

```ts
interface WindowOptions {
  targetRunes: number;   // default 4000 (~1000 tokens)
  overlapRunes: number;  // default 400 — trailing sentence carry-forward
}
```

---

## Lattice (KLR clustering)

A Node is a maximal clique: all members pairwise similar above a level-relative
threshold. Clusters may overlap. Orphans pass upward unchanged.

Each source produces a **source-tier forest** (roots + orphans = source
frontier). All sources' frontiers are clustered into the **corpus tier**, which
descent enters from.

### Clustering path — crossover at 2000 artifacts

#### ≤ 2000 — exact pairwise

1. Full n×n cosine similarity matrix.
2. Sample up to 200,000 pairs → estimate percentile → threshold.
3. Find all maximal cliques above threshold.
4. No IVF index stored.

At n=2000: matrix = 32MB, milliseconds.

#### > 2000 — IVF k-NN graph + PCA

**PCA is used in two places:**

**Place 1 — Graph build (offline, per rebuild):**
1. Fit 128-dim orthonormal PCA basis over pool's dominant directions.
   Uncentered subspace iteration; sample ≤ 1000 vectors; 4 iterations.
   Uncentered because we are approximating dot products, not centered variance.
2. Project every artifact to 128 dims.
3. K-means projections into ~√n cells (Lloyd's, 8 iterations, fixed seeds).
4. Per artifact: score candidates in nearest 4 IVF cells at projected dims →
   rerank pool with exact full-dimension dot products → keep top k=32.
   Symmetrize edges.
5. Store PCA basis + IVF assignments as the level index.

All graph similarities are exact full-dimension dot products. PCA only guides
candidate selection.

**Place 2 — Query-time descent:**
Project the query vector into the stored PCA basis → probe nearest IVF cells
→ score the resulting frontier subset with exact dot products. Without this,
descent would have to score every corpus frontier node — fine at small scale,
slow at tens of thousands.

**Incremental repair:**
When < 20% of the artifact pool changed, the level index is updated locally.
If the pinned threshold drifted > 2% from the pool's current percentile, repair
is refused and a full rebuild runs instead.

```ts
interface KNNConfig {
  k: number;                  // default 32
  pcaDims: number;            // default 128
  cells?: number;             // default ≈ √n
  maxClusterPool: number;     // exact/sparse crossover; default 2000
  repairMaxFraction: number;  // default 0.2
  repairMaxDrift: number;     // default 0.02
}
```

---

## Retrieval

Descent is the only retrieval path. No public exact mode. If descent surfaces
no candidates, **the result is empty** — no fallback scan. A large corpus that
descent finds nothing in is not served by a full scan; the caller gets an empty
result and can decide what to do.

```
1. Embed the query string(s) → query vector(s).
2. If IVF index exists: project query via stored PCA basis → probe nearest
   cells → candidate frontier nodes. Otherwise: score all frontier nodes.
3. Best-first descent (beam 3, threshold 0.35, cap 256 expansions).
4. Collect window candidates above threshold.
5. No candidates → return empty result.
6. Rank by cosine similarity. retrieveMany pools rankings across queries,
   each window keeping its best score.
7. Merge → Regions (see below). Admit under 4000-byte budget.
```

### Regions

Overlapping or touching windows from the same source are merged into one
contiguous Region. Non-overlapping windows from the same source produce
separate Regions. Density = number of retrieved windows that covered the span.
There is no sub-region density breakdown — the region is one contiguous span
with one density count.

```ts
interface Region {
  sourceId: string;
  label: string;      // from the window — no secondary lookup
  start: number;      // UTF-16 code-unit offset, inclusive
  end: number;        // UTF-16 code-unit offset, exclusive
  text: string;       // verbatim, stored at index time
  relevance: number;  // best covering window's cosine similarity
  density: number;    // how many windows covered this span
}

interface RetrieveResult {
  regions: Region[];
  usage: Usage;
}
```

Budget admission: regions ranked by relevance then density. Dense regions
(density ≥ 2) may overage by 25%. Top region always admitted regardless of
size.

### Public surface (on the Knowledge object, no project ID):

```ts
retrieve(query: string, options?: KnowledgeRetrievalOptions): Promise<RetrieveResult>
retrieveMany(queries: string[], options?: KnowledgeRetrievalOptions): Promise<RetrieveResult[]>
resolveScope(scope?: ContextEntry[]): Promise<KnowledgeScopeManifest | null>
searchTool(): ToolBinding   // sync — returns the binding, handler inside is async
```

The `topK?: number` second parameter described in earlier revisions of this
document was replaced when Context scoping landed. Retrieval now takes an
options object carrying `topK` and either a `scope` (`ContextEntry[]`) or an
already-resolved `scopeManifest`. `resolveScope` is the seam a caller uses to
freeze one manifest and reuse it across every query in a run — see
[context-design.md](context-design.md).

`searchTool()` is synchronous — it returns a `ToolBinding` immediately. The
handler *inside* the binding is async (it calls `retrieve`).

---

## SearchTool

```
name:    "knowledge.search"
input:   { query: string; topK?: number }
output:  { regions: Region[] }
handler: calls this.retrieve(query, topK)
```

Project scope is already bound in the store. The model never sees or controls
any project or table identifier.

---

## Embedder interface

```ts
interface Embedder {
  // inputs batched in one call — rate-limit and cost benefit is automatic
  embed(inputs: string[]): Promise<{ vectors: number[][]; usage: Usage }>;
}
```

Wrapper constructed inside `createKnowledge`:

```ts
class IntelligenceEmbedder implements Embedder {
  constructor(private intelligence: Intelligence) {}
  async embed(inputs: string[]) {
    // undefined = no AbortSignal; wired when we add request cancellation
    const result = await this.intelligence.embed(undefined, { inputs });
    return { vectors: result.vectors, usage: result.usage };
  }
}
```

---

## Store interface (SQLite-backed)

All tables are project-scoped by name; no project ID in method signatures.

```ts
interface KnowledgeStore {
  // Source registry
  getSource(sourceId: string): Promise<SourceRecord | undefined>
  putSource(record: SourceRecord): Promise<void>
  deleteSource(sourceId: string): Promise<void>
  listSources(): Promise<SourceRecord[]>

  // Windows (include label for O(1) region building)
  getWindows(ids: string[]): Promise<Window[]>
  putWindows(windows: Window[]): Promise<void>
  deleteWindowsForSource(sourceId: string): Promise<void>

  // Nodes
  getNodes(ids: string[]): Promise<Node[]>
  putNodes(nodes: Node[]): Promise<void>
  deleteNodesForSource(sourceId: string): Promise<void>
  deleteCorpusNodes(): Promise<void>

  // Frontier (corpus-tier entry points for descent)
  getFrontier(): Promise<FrontierEntry[]>

  // IVF level index (k-NN path only)
  getLevelIndex(level: number): Promise<StoredLevelIndex | undefined>
  putLevelIndex(index: StoredLevelIndex): Promise<void>
  deleteLevelIndex(): Promise<void>
}
```

`resolveKnowledgeStore(projectId, db)` derives table names from projectId and
returns a store instance. Knowledge never sees the project ID after that.

---

## File layout

```
src/0-platform/knowledge/
  types.ts         Window, Node, SourceRecord, Region, RetrieveResult, AddItem,
                   AddResult, FrontierEntry, StoredLevelIndex, KNNConfig
  embedder.ts      Embedder interface + IntelligenceEmbedder
  windows.ts       windowText() + StreamWindower
  cluster.ts       KLR clustering: exact pairwise + k-NN graph paths
  knn.ts           fitProjection (PCA), buildKNNGraph, IVF cell assignment + repair
  descent.ts       descend(queryVec, store) → Window[]
  regions.ts       buildRegions(ranked, budget) → Region[]
  store.ts         KnowledgeStore interface + resolveKnowledgeStore()
  knowledge.ts     Knowledge class
  index.ts         re-exports

src/0-platform/database/
  knowledge-store.ts   SQLiteKnowledgeStore implements KnowledgeStore

src/1-init/create/
  knowledge.ts         createKnowledge(projectId, db, intelligence, opts): Knowledge
```

---

## Deferred / dropped

- **Block spans** — dropped entirely.
- **Generation pinning** — ~~not needed; writes are serialized through the job
  queue~~. **Superseded.** A project Knowledge generation counter now exists. It
  is not owned by Knowledge: a successful add/remove conservatively increments
  one counter held by the Derived Outputs store, which marks dependents stale
  and fences an in-flight refresh from publishing against content that changed
  mid-run. Serialising writes was never the issue — the issue is a long-running
  consumer that froze its material at the start and settles after the corpus
  moved. Where the counter should live deserves revisiting now that a second
  consumer (Research) needs the same fence.
- **Exact fallback scan** — dropped; no candidates means empty result.
- **In-memory store** — going straight to SQLite.
- **Public addBatch** — not needed; embedding batching is automatic.
- **Sub-region density breakdown** — one contiguous span, one density count.

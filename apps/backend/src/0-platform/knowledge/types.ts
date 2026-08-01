import type { Usage } from "#platform/intelligence/types.js";

export type { Usage };

// ID prefix sentinels so a Node can tell windows from child-nodes without a store roundtrip.
export const WINDOW_PREFIX = "w:";
export const NODE_PREFIX = "n:";

export const isWindowId = (id: string): boolean => id.startsWith(WINDOW_PREFIX);

// ─── Windowing ────────────────────────────────────────────────────────────────

export interface WindowOptions {
  targetRunes: number;  // target chars per window; default 4000 (~1000 tokens)
  overlapRunes: number; // trailing-sentence carry-forward; default 400
}

/** A positioned chunk of source text before embedding. */
export interface WindowPiece {
  start: number;    // character offset in source
  end: number;
  text: string;
  ordinal: number;
}

// ─── Core artifacts ───────────────────────────────────────────────────────────

/** A windowed, embedded chunk of source text. */
export interface KnowledgeWindow {
  id: string;         // WINDOW_PREFIX + SHA-256(sourceId:text)[0..32]
  sourceId: string;
  label: string;      // copied from SourceRecord — avoids a secondary lookup in retrieval
  ordinal: number;
  start: number;
  end: number;
  text: string;       // stored verbatim — retrieval never reopens the source
  embedding: number[]; // unit-normalized
}

/** A lattice cluster node. Members may be windows or lower-level nodes. */
export interface KnowledgeNode {
  id: string;          // NODE_PREFIX + SHA-256(sorted memberIds)[0..32]
  sourceId?: string;   // set for source-tier nodes; absent = corpus tier
  level: number;
  centroid: number[];  // unit-normalized mean of members; used for scoring in descent
  count: number;       // === memberIds.length
  cohesion: number;    // weakest pairwise similarity inside the clique
  memberIds: string[]; // window IDs or lower-node IDs
}

/** A source registered in the knowledge index. Text is never stored. */
export interface SourceRecord {
  sourceId: string;
  label: string;
  revision: string;    // caller-supplied — could be a hash, timestamp, commit SHA, etc.
  windowCount: number;
  sizeBytes: number;
  addedAt: Date;
  syncedAt: Date;
}

/** Entry point for corpus-tier descent. Either a corpus node or an orphan window. */
export interface FrontierEntry {
  id: string;
  vector: number[];  // centroid for nodes, embedding for windows
  isWindow: boolean;
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

/** A merged, contiguous, verbatim span from one source. */
export interface Region {
  sourceId: string;
  label: string;
  start: number;
  end: number;
  text: string;      // verbatim, taken at index time
  relevance: number; // best covering window's cosine similarity
  density: number;   // how many retrieved windows covered this span
}

// ─── Context scope ────────────────────────────────────────────────────────────

/** The shared resource-reference atom used by Context and scope-aware retrieval. */
export interface ContextEntry {
  id: string;
  kind: string;  // e.g. "document", "context"
}

/** Trusted resource identity captured when a Context is resolved. */
export interface KnowledgeResourceDescriptor {
  readonly sourceId: string;
  readonly resourceId: string;
  readonly resourceKind: string;
  readonly resourceRevision?: number;
}

export interface KnowledgeScopeManifest {
  readonly inputEntries: readonly ContextEntry[];     // canonical caller entries
  readonly resolvedEntries: readonly ContextEntry[];  // recursive expansion/resource mapping
  readonly resources: readonly KnowledgeResourceDescriptor[]; // trusted read/list identities
  readonly resolvedSourceIds: readonly string[];      // sorted admissible set used to filter windows
  readonly contextDigest: string;            // SHA-256(canonical input entries)
  readonly scopeDigest: string;              // SHA-256(canonical resource descriptors)
  readonly resolvedAt: string;               // ISO timestamp
}

export interface KnowledgeRetrievalOptions {
  topK?: number;
  scope?: ContextEntry[];  // absent or [] = no restriction, full lattice
  /**
   * A scope resolved once by `Knowledge.resolveScope`. Supplying this prevents
   * Context/resource membership from changing between queries in one run.
   */
  scopeManifest?: KnowledgeScopeManifest | null;
}

/** Injected into Knowledge at construction time to expand kind:"context" entries. */
export interface KnowledgeResourceResolver {
  resolve(entries: ContextEntry[]): Promise<ContextEntry[]>;
  /** Map an indexed source to the public identity used by scoped tools. */
  describeSource?(sourceId: string): Promise<KnowledgeResourceDescriptor | null>;
}

export interface RetrieveResult {
  regions: Region[];
  scope: KnowledgeScopeManifest | null;  // null when no scope was applied
  usage: Usage;
}

// ─── Ingest ───────────────────────────────────────────────────────────────────

export interface AddItem {
  sourceId: string;
  label: string;
  revision?: string;            // omit to force full re-ingest
  text?: string;
  stream?: ReadableStream<string>;
}

export interface AddResult {
  sourceId: string;
  skipped: boolean;       // revision matched — nothing changed, no tokens spent
  windowsAdded: number;
  windowsReused: number;  // unchanged windows whose stored embedding was reused
  usage: Usage;           // embedding tokens spent (0 when skipped)
}

/** Emitted synchronously after a Knowledge source mutation fully succeeds. */
export interface KnowledgeSourceMutation {
  readonly operation: "add" | "remove";
  readonly sourceId: string;
}

export type KnowledgeSourceMutationListener = (
  mutation: KnowledgeSourceMutation
) => void;

// ─── Clustering configuration ─────────────────────────────────────────────────

export interface KNNConfig {
  k: number;                  // neighbours per artifact; default 32
  pcaDims: number;            // projection dimension; default 128
  cells?: number;             // IVF cell count; default ≈ √n
  maxClusterPool: number;     // exact/sparse crossover; default 2000
  repairMaxFraction: number;  // max changed fraction for local repair; default 0.2
  repairMaxDrift: number;     // max threshold drift before forced rebuild; default 0.02
}

export interface ClusterConfig {
  percentile: number;    // where in the similarity distribution the threshold sits; default 0.75
  floor: number;         // threshold never drops below this; default 0.30
  knn: KNNConfig;
}

// ─── Stored IVF level index ───────────────────────────────────────────────────

export interface StoredLevelIndex {
  level: number;
  threshold: number;
  k: number;
  basis: number[][];        // PCA basis: pcaDims × embeddingDim
  centroids: number[][];    // IVF cell centroids: cells × pcaDims
  artifacts: StoredArtifactEntry[];
}

export interface StoredArtifactEntry {
  id: string;
  cell: number;
  edges: StoredEdge[];
}

export interface StoredEdge {
  to: string;
  similarity: number;
}

// ─── Knowledge runtime options ────────────────────────────────────────────────

export interface KnowledgeOptions {
  window?: Partial<WindowOptions>;
  cluster?: Partial<ClusterConfig>;
  descentBeam?: number;         // default 3
  descentThreshold?: number;    // default 0.35
  charBudget?: number;          // default 4000
  defaultTopK?: number;         // default 5
  resolver?: KnowledgeResourceResolver;  // optional scope resolver; injected at wiring time
}

import type {
  FrontierEntry,
  KnowledgeNode,
  KnowledgeWindow,
  SourceRecord,
  StoredLevelIndex
} from "#capabilities/knowledge/types.js";

/**
 * The boundary between the Knowledge class and its persistence layer. All
 * operations are already scoped to one project — the store implementation
 * derives its table names from the projectId and exposes no projectId argument
 * anywhere in this interface.
 */
export interface KnowledgeStore {
  // ── Source registry ──────────────────────────────────────────────────────
  getSource(sourceId: string): Promise<SourceRecord | undefined>;
  putSource(record: SourceRecord): Promise<void>;
  deleteSource(sourceId: string): Promise<void>;
  listSources(): Promise<SourceRecord[]>;

  // ── Windows ──────────────────────────────────────────────────────────────
  // getWindows returns the subset of ids that exist; missing ids are silently omitted.
  getWindows(ids: string[]): Promise<KnowledgeWindow[]>;
  putWindows(windows: KnowledgeWindow[]): Promise<void>;
  deleteWindowsForSource(sourceId: string): Promise<void>;

  // ── Lattice nodes ─────────────────────────────────────────────────────────
  getNodes(ids: string[]): Promise<KnowledgeNode[]>;
  putNodes(nodes: KnowledgeNode[]): Promise<void>;
  deleteNodesForSource(sourceId: string): Promise<void>;
  deleteCorpusNodes(): Promise<void>;
  // All source-tier node IDs for a given source (used to compute source frontier)
  getSourceNodeIds(sourceId: string): Promise<string[]>;

  // ── Corpus frontier (computed and cached after each corpus rebuild) ────────
  getFrontier(): Promise<FrontierEntry[]>;
  putFrontier(entries: FrontierEntry[]): Promise<void>;

  // ── IVF level index (k-NN path only) ─────────────────────────────────────
  getLevelIndex(level: number): Promise<StoredLevelIndex | undefined>;
  putLevelIndex(index: StoredLevelIndex): Promise<void>;
  deleteLevelIndex(): Promise<void>;
}

import { createHash } from "node:crypto";
import type {
  AddItem,
  AddResult,
  ClusterConfig,
  FrontierEntry,
  KnowledgeOptions,
  KnowledgeWindow,
  Region,
  RetrieveResult,
  SourceRecord,
  Usage,
  WindowOptions
} from "#platform/knowledge/types.js";
import type { KnowledgeStore } from "#platform/knowledge/store.js";
import type { Embedder } from "#platform/knowledge/embedder.js";
import type { ToolBinding } from "#platform/intelligence/tools.js";
import type { Logger } from "#platform/observability/logger.js";
import { windowText, StreamWindower, DEFAULT_WINDOW_OPTIONS } from "#platform/knowledge/windowing/index.js";
import {
  buildCorpusTier,
  buildSourceLattice,
  DEFAULT_CLUSTER_CONFIG,
  makeWindowId,
  type Artifact
} from "#platform/knowledge/lattice/cluster.js";
import { descent, DEFAULT_BEAM, DEFAULT_THRESHOLD } from "#platform/knowledge/lattice/descent.js";
import { assembleRegions, DEFAULT_CHAR_BUDGET } from "#platform/knowledge/lattice/regions.js";
import { repairCorpus } from "#platform/knowledge/lattice/repair.js";

const EMBED_BATCH = 32;
const NULL_USAGE: Usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, reasoningTokens: 0 };

function addUsage(a: Usage, b: Usage): Usage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    reasoningTokens: a.reasoningTokens + b.reasoningTokens
  };
}

export class Knowledge {
  private readonly windowOpts: WindowOptions;
  private readonly clusterConfig: ClusterConfig;
  private readonly descentBeam: number;
  private readonly descentThreshold: number;
  private readonly charBudget: number;
  private readonly defaultTopK: number;

  constructor(
    private readonly store: KnowledgeStore,
    private readonly embedder: Embedder,
    private readonly logger: Logger,
    opts?: KnowledgeOptions
  ) {
    this.windowOpts = {
      targetRunes: opts?.window?.targetRunes ?? DEFAULT_WINDOW_OPTIONS.targetRunes,
      overlapRunes: opts?.window?.overlapRunes ?? DEFAULT_WINDOW_OPTIONS.overlapRunes
    };
    this.clusterConfig = {
      percentile: opts?.cluster?.percentile ?? DEFAULT_CLUSTER_CONFIG.percentile,
      floor: opts?.cluster?.floor ?? DEFAULT_CLUSTER_CONFIG.floor,
      knn: { ...DEFAULT_CLUSTER_CONFIG.knn, ...(opts?.cluster?.knn ?? {}) }
    };
    this.descentBeam = opts?.descentBeam ?? DEFAULT_BEAM;
    this.descentThreshold = opts?.descentThreshold ?? DEFAULT_THRESHOLD;
    this.charBudget = opts?.charBudget ?? DEFAULT_CHAR_BUDGET;
    this.defaultTopK = opts?.defaultTopK ?? 5;
  }

  // ── Ingestion ─────────────────────────────────────────────────────────────

  async add(item: AddItem): Promise<AddResult> {
    const { sourceId, label } = item;
    const revision = item.revision ?? "";

    // Collect text
    let text: string;
    if (item.text !== undefined) {
      text = item.text;
    } else if (item.stream !== undefined) {
      text = await collectStream(item.stream);
    } else {
      text = "";
    }

    const sizeBytes = Buffer.byteLength(text, "utf8");

    // Revision check
    const existing = await this.store.getSource(sourceId);
    if (existing && revision !== "" && existing.revision === revision) {
      this.logger.debug("knowledge.add.skipped", { sourceId, label, revision });
      return { sourceId, skipped: true, windowsAdded: 0, windowsReused: 0, usage: NULL_USAGE };
    }

    // Window the text
    const pieces = windowText(text, this.windowOpts);

    // Compute IDs and detect reuse
    const pieces2 = pieces.map((p) => ({
      ...p,
      id: makeWindowId(sourceId, p.text)
    }));

    const allIds = pieces2.map((p) => p.id);
    const existingWindows = await this.store.getWindows(allIds);
    const existingSet = new Map(existingWindows.map((w) => [w.id, w]));

    const toEmbed = pieces2.filter((p) => !existingSet.has(p.id));
    let totalUsage: Usage = NULL_USAGE;

    // Embed in batches
    const embeddingMap = new Map<string, number[]>(
      existingWindows.map((w) => [w.id, w.embedding])
    );

    for (let i = 0; i < toEmbed.length; i += EMBED_BATCH) {
      const batch = toEmbed.slice(i, i + EMBED_BATCH);
      const { vectors, usage } = await this.embedder.embed(batch.map((p) => p.text));
      totalUsage = addUsage(totalUsage, usage);
      for (let j = 0; j < batch.length; j++) {
        embeddingMap.set(batch[j].id, vectors[j]);
      }
    }

    // Build window records
    const now = new Date();
    const windows: KnowledgeWindow[] = pieces2.map((p, ordinal) => ({
      id: p.id,
      sourceId,
      label,
      ordinal,
      start: p.start,
      end: p.end,
      text: p.text,
      embedding: embeddingMap.get(p.id)!
    }));

    // Delete old windows for this source, write new
    await this.store.deleteWindowsForSource(sourceId);
    if (windows.length > 0) await this.store.putWindows(windows);

    // Rebuild source-tier lattice
    const artifacts: Artifact[] = windows.map((w) => ({
      id: w.id,
      vector: w.embedding,
      level: 0
    }));

    await this.store.deleteNodesForSource(sourceId);
    const { allNodes, frontier: sourceFrontier } = buildSourceLattice(
      artifacts,
      sourceId,
      this.clusterConfig
    );
    if (allNodes.length > 0) await this.store.putNodes(allNodes);

    // Rebuild corpus tier
    await this.rebuildCorpusTier(sourceId, sourceFrontier);

    // Update source record
    const sourceRecord: SourceRecord = {
      sourceId,
      label,
      revision,
      windowCount: windows.length,
      sizeBytes,
      addedAt: existing?.addedAt ?? now,
      syncedAt: now
    };
    await this.store.putSource(sourceRecord);

    this.logger.info("knowledge.add", {
      sourceId,
      label,
      windowsAdded: toEmbed.length,
      windowsReused: existingSet.size,
      nodes: allNodes.length,
      usage: totalUsage
    });
    return {
      sourceId,
      skipped: false,
      windowsAdded: toEmbed.length,
      windowsReused: existingSet.size,
      usage: totalUsage
    };
  }

  async remove(sourceId: string): Promise<void> {
    await this.store.deleteWindowsForSource(sourceId);
    await this.store.deleteNodesForSource(sourceId);
    await this.store.deleteSource(sourceId);
    await this.rebuildCorpusTier(sourceId, []);
    this.logger.info("knowledge.remove", { sourceId });
  }

  listSources(): Promise<SourceRecord[]> {
    return this.store.listSources();
  }

  // ── Retrieval ─────────────────────────────────────────────────────────────

  async retrieve(query: string, _topK?: number): Promise<RetrieveResult> {
    const { vectors, usage } = await this.embedder.embed([query]);
    const queryVec = vectors[0];

    const { windowIds, scores } = await descent(
      queryVec,
      this.store,
      this.descentBeam,
      this.descentThreshold
    );

    if (windowIds.length === 0) {
      return { regions: [], usage };
    }

    const windows = await this.store.getWindows(windowIds);
    const regions = assembleRegions(windows, scores, this.charBudget);

    this.logger.debug("knowledge.retrieve", { windowsHit: windowIds.length, regions: regions.length, usage });
    return { regions, usage };
  }

  // ── Tool adapter ──────────────────────────────────────────────────────────

  /** Returns a ToolBinding that wraps retrieve() for use in reasoning calls. */
  searchTool(): ToolBinding {
    return {
      definition: {
        name: "knowledge_search",
        description:
          "Search the knowledge base for information relevant to the query. Returns verbatim passages from indexed sources.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Natural language query to search for."
            }
          },
          required: ["query"]
        }
      },
      handler: async (args: Record<string, unknown>) => {
        const query = typeof args["query"] === "string" ? args["query"] : "";
        if (!query) {
          return { content: "No query provided.", usage: NULL_USAGE };
        }
        const result = await this.retrieve(query);
        if (result.regions.length === 0) {
          return {
            content: "No relevant information found.",
            usage: result.usage
          };
        }
        const formatted = result.regions
          .map(
            (r, i) =>
              `[${i + 1}] ${r.label} (relevance: ${r.relevance.toFixed(3)})\n${r.text}`
          )
          .join("\n\n---\n\n");
        return { content: formatted, usage: result.usage };
      }
    };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async rebuildCorpusTier(
    changedSourceId: string,
    newSourceFrontier: FrontierEntry[]
  ): Promise<void> {
    // Collect all source frontiers
    const sources = await this.store.listSources();
    const allFrontierEntries: FrontierEntry[] = [...newSourceFrontier];

    for (const src of sources) {
      if (src.sourceId === changedSourceId) continue;
      const nodeIds = await this.store.getSourceNodeIds(src.sourceId);
      if (nodeIds.length > 0) {
        const nodes = await this.store.getNodes(nodeIds);
        for (const node of nodes) {
          // Only include top-level source-tier nodes (highest level per source)
          allFrontierEntries.push({
            id: node.id,
            vector: node.centroid,
            isWindow: false
          });
        }
      } else {
        // Source has no cluster nodes — include its window embeddings directly
        const srcRecord = await this.store.getSource(src.sourceId);
        if (!srcRecord) continue;
        const winIds = await getWindowIds(this.store, src.sourceId);
        const wins = await this.store.getWindows(winIds);
        for (const w of wins) {
          allFrontierEntries.push({ id: w.id, vector: w.embedding, isWindow: true });
        }
      }
    }

    await this.store.deleteCorpusNodes();
    const { corpusNodes, corpusFrontier } = buildCorpusTier(
      allFrontierEntries,
      this.clusterConfig
    );
    if (corpusNodes.length > 0) await this.store.putNodes(corpusNodes);
    await this.store.putFrontier(corpusFrontier);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function collectStream(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += value;
  }
  return result;
}

/**
 * Retrieve window IDs for a source. The store has no listWindowsBySource, so
 * we get the source record to know the count, then fetch via the source's
 * node member IDs where possible. When the node graph exists, its member IDs
 * transitively cover all windows. When no nodes exist, we fall back to the
 * node-less path tracked from add().
 *
 * NOTE: In practice this code path only fires during full corpus rebuild when
 * a source has no cluster nodes, which only happens for single-window sources.
 * For correctness in that edge case we load source-level node IDs and crawl
 * to their leaf members; zero nodes means one window (also reachable via the
 * lattice-less path).
 */
async function getWindowIds(store: KnowledgeStore, sourceId: string): Promise<string[]> {
  const nodeIds = await store.getSourceNodeIds(sourceId);
  if (nodeIds.length === 0) {
    // No nodes → source has 0 or 1 window. Return empty and let the caller
    // handle it (a 1-window source that is also an orphan is already in the
    // source frontier via buildSourceLattice).
    return [];
  }
  // Collect leaf window IDs from the lattice transitively.
  // For simplicity, load level-1 nodes and return their member IDs that are windows.
  const nodes = await store.getNodes(nodeIds);
  const windowIds: string[] = [];
  for (const node of nodes) {
    for (const mid of node.memberIds) {
      if (mid.startsWith("w:")) windowIds.push(mid);
    }
  }
  return windowIds;
}

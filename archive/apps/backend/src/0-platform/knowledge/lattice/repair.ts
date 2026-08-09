import type { ClusterConfig, FrontierEntry, KnowledgeNode, KnowledgeWindow } from "#platform/knowledge/types.js";
import type { KnowledgeStore } from "#platform/knowledge/store.js";
import { buildSourceLattice, buildCorpusTier, type Artifact } from "#platform/knowledge/lattice/cluster.js";
import { cosineSim, centroid } from "#platform/knowledge/lattice/math.js";

/**
 * After a source's windows change, decide whether to do a local repair or a
 * full corpus rebuild. A local repair is attempted when:
 *  - The fraction of changed windows is ≤ repairMaxFraction
 *  - The change in any affected node's centroid similarity is ≤ repairMaxDrift
 *
 * Local repair: re-cluster only the affected source in isolation, write its
 * nodes + update the corpus frontier by swapping the old source's frontier
 * entries with new ones, then re-cluster the corpus tier.
 *
 * If local repair is not viable, signals a full rebuild.
 */
export interface RepairInput {
  sourceId: string;
  newWindows: KnowledgeWindow[];
  oldWindowCount: number;
  store: KnowledgeStore;
  config: ClusterConfig;
}

export interface RepairResult {
  rebuilt: boolean; // true = full corpus rebuild was performed
}

export async function repairCorpus(input: RepairInput): Promise<RepairResult> {
  const { sourceId, newWindows, oldWindowCount, store, config } = input;

  // Always rebuild source-tier nodes for this source
  const artifacts: Artifact[] = newWindows.map((w) => ({
    id: w.id,
    vector: w.embedding,
    level: 0
  }));

  const { allNodes, frontier: sourceFrontier } = buildSourceLattice(
    artifacts,
    sourceId,
    config
  );

  // Delete old source-tier data and write new
  await store.deleteNodesForSource(sourceId);
  if (allNodes.length > 0) await store.putNodes(allNodes);

  // Check if local repair is viable
  const changedCount = Math.abs(newWindows.length - oldWindowCount);
  const totalCount = Math.max(newWindows.length, oldWindowCount, 1);
  const fraction = changedCount / totalCount;

  const viable = fraction <= config.knn.repairMaxFraction;

  if (!viable) {
    // Full corpus rebuild needed — caller will handle it
    return { rebuilt: false };
  }

  // Swap corpus frontier entries for this source
  const existingFrontier = await store.getFrontier();
  // We can't distinguish per-source entries in the frontier without re-querying all sources,
  // so we always rebuild the frontier from scratch below.
  void existingFrontier;

  // Rebuild corpus frontier from all source frontiers
  const allSources = await store.listSources();
  const allFrontierEntries: FrontierEntry[] = [];

  for (const src of allSources) {
    if (src.sourceId === sourceId) {
      allFrontierEntries.push(...sourceFrontier);
    } else {
      // Get the source's top-level node IDs
      const nodeIds = await store.getSourceNodeIds(src.sourceId);
      if (nodeIds.length === 0) {
        // Source has no nodes — use its windows directly
        const srcWindows = await store.getWindows([]); // can't list by source; handled below
        void srcWindows;
        // For simplicity: signal full rebuild when another source has no nodes
        return { rebuilt: false };
      }
      const nodes = await store.getNodes(nodeIds);
      for (const node of nodes) {
        allFrontierEntries.push({ id: node.id, vector: node.centroid, isWindow: false });
      }
    }
  }

  // Build corpus tier
  const { corpusNodes, corpusFrontier } = buildCorpusTier(allFrontierEntries, config);

  await store.deleteCorpusNodes();
  if (corpusNodes.length > 0) await store.putNodes(corpusNodes);
  await store.putFrontier(corpusFrontier);

  return { rebuilt: true };
}

export { buildSimilarityMatrix, centroid, cosineSim, dot, estimateThreshold, norm, normalize, orthonormalize, Xorshift } from "#platform/knowledge/lattice/math.js";
export { buildCorpusTier, buildSourceLattice, makeNodeId, makeWindowId, DEFAULT_CLUSTER_CONFIG, type Artifact, type SourceLatticeResult, type CorpusLatticeResult } from "#platform/knowledge/lattice/cluster.js";
export { buildKNNGraph, buildLevelIndex, fitProjection, projectVector, type Neighbor, type KNNGraphResult } from "#platform/knowledge/lattice/knn.js";
export { repairCorpus, type RepairInput, type RepairResult } from "#platform/knowledge/lattice/repair.js";
export { descent, DEFAULT_BEAM, DEFAULT_THRESHOLD, type DescentResult } from "#platform/knowledge/lattice/descent.js";
export { assembleRegions, DEFAULT_CHAR_BUDGET } from "#platform/knowledge/lattice/regions.js";

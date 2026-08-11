export { buildSimilarityMatrix, centroid, cosineSim, dot, estimateThreshold, norm, normalize, orthonormalize, Xorshift } from "#capabilities/knowledge/lattice/math.js";
export { buildCorpusTier, buildSourceLattice, makeNodeId, makeWindowId, DEFAULT_CLUSTER_CONFIG, type Artifact, type SourceLatticeResult, type CorpusLatticeResult } from "#capabilities/knowledge/lattice/cluster.js";
export { buildKNNGraph, buildLevelIndex, fitProjection, projectVector, type Neighbor, type KNNGraphResult } from "#capabilities/knowledge/lattice/knn.js";
export { repairCorpus, type RepairInput, type RepairResult } from "#capabilities/knowledge/lattice/repair.js";
export { descent, DEFAULT_BEAM, DEFAULT_THRESHOLD, type DescentResult } from "#capabilities/knowledge/lattice/descent.js";
export { assembleRegions, DEFAULT_CHAR_BUDGET } from "#capabilities/knowledge/lattice/regions.js";

/**
 * Reading order for the complete architecture suite.
 *
 * The original trees establish the repository vocabulary. Pillar trees then
 * enforce the cross-cutting ownership and behavior guarantees that cannot be
 * expressed by one source tree alone.
 */
export const CHECKER_TREES = [
  "capabilities",
  "components",
  "model",
  "representation",
  "runtime",
  "styles",
  "surfaces",
  "views",
  "across",
  "state-ownership",
  "procedural-transparency",
  "scoped-authority",
  "owned-lifecycle",
  "atomic-invariants",
  "gated-crossings",
  "authoritative-data",
  "cohesive-units"
];

export const PILLAR_TREES = new Set(CHECKER_TREES.slice(9));

/** Server-to-server capability entry points that must not cross a remote wrapper. */
export { enqueueSemanticSync } from "$capabilities/semantic-overlay/api/enqueue-semantic-sync/enqueue-semantic-sync";
/** Server-only shared contracts consumed by collaborating capabilities. */
export {
  readSemanticResourceFor,
  readSemanticResourceForModel
} from "$capabilities/semantic-overlay/api/shared/resource";
export { materialProfileDigest } from "$capabilities/semantic-overlay/api/shared/material-facets";
export {
  currentResourceRevisionFor,
  materialPlacementIsCurrent,
  materialRecordIsCurrent,
  materialSourceIsCurrent,
  semanticSourceIsCurrent
} from "$capabilities/semantic-overlay/api/shared/freshness";

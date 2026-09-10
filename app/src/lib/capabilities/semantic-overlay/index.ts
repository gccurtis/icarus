/** Server-to-server capability entry points that must not cross a remote wrapper. */
export { enqueueSemanticSync } from "$capabilities/semantic-overlay/api/enqueue-semantic-sync/enqueue-semantic-sync";
export { querySemanticOverlay } from "$capabilities/semantic-overlay/api/query-semantic-overlay/query-semantic-overlay";
export { querySemanticMaterials } from "$capabilities/semantic-overlay/api/query-semantic-materials/query-semantic-materials";
/** Server-only shared contracts consumed by collaborating capabilities. */
export {
  readSemanticResourceFor,
  readSemanticResourceForModel
} from "$capabilities/semantic-overlay/api/shared/resource";
export { materialProfileDigest } from "$capabilities/semantic-overlay/api/shared/material-facets";
export { forgetSemanticResourceFor } from "$capabilities/semantic-overlay/api/shared/forget";
export { isStagedResource } from "$capabilities/semantic-overlay/api/shared/staged";
export { processSemanticSyncQueueFor } from "$capabilities/semantic-overlay/api/shared/queue-processor";
export { enqueueSemanticOutboxFor } from "$capabilities/semantic-overlay/api/shared/outbox";
export {
  currentResourceRevisionFor,
  materialPlacementIsCurrent,
  materialRecordIsCurrent,
  materialSourceIsCurrent,
  semanticSourceIsCurrent
} from "$capabilities/semantic-overlay/api/shared/freshness";

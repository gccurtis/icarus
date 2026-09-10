/** Server-to-server capability entry points that must not cross a remote wrapper. */
export { enqueueSemanticSync } from "$capabilities/semantic-overlay/api/enqueue-semantic-sync/enqueue-semantic-sync";
export { querySemanticOverlay } from "$capabilities/semantic-overlay/api/query-semantic-overlay/query-semantic-overlay";
export { querySemanticMaterials } from "$capabilities/semantic-overlay/api/query-semantic-materials/query-semantic-materials";
export { readSemanticStatus } from "$capabilities/semantic-overlay/api/read-semantic-status/read-semantic-status";
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
export type { SemanticOutboxReceipt } from "$capabilities/semantic-overlay/api/shared/outbox";
export {
  readSemanticStatusFor,
  semanticStatusReaderFor
} from "$capabilities/semantic-overlay/api/shared/status";
export type { SemanticStatusReader } from "$capabilities/semantic-overlay/api/shared/status";
export {
  currentResourceRevisionFor,
  materialPlacementIsCurrent,
  materialRecordIsCurrent,
  materialSourceIsCurrent,
  semanticSourceIsCurrent
} from "$capabilities/semantic-overlay/api/shared/freshness";
export type {
  ExactSemanticStatus,
  MaterialSemanticStatus,
  ReadSemanticStatusInput,
  ReadSemanticStatusResult,
  SemanticLaneState,
  SemanticLaneStatus
} from "$capabilities/semantic-overlay/types/read-semantic-status";

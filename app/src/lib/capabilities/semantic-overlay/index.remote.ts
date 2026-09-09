import { command, query } from "$app/server";
import { querySemanticOverlay as querySemanticOverlayProcedure } from "$capabilities/semantic-overlay/api/query-semantic-overlay/query-semantic-overlay";
import { rebuildSemanticIndex as rebuildSemanticIndexProcedure } from "$capabilities/semantic-overlay/api/rebuild-semantic-index/rebuild-semantic-index";
import { readSemanticResource as readSemanticResourceProcedure } from "$capabilities/semantic-overlay/api/read-semantic-resource/read-semantic-resource";
import { syncSemanticResource as syncSemanticResourceProcedure } from "$capabilities/semantic-overlay/api/sync-semantic-resource/sync-semantic-resource";
import { processSemanticSyncQueue as processSemanticSyncQueueProcedure } from "$capabilities/semantic-overlay/api/process-semantic-sync-queue/process-semantic-sync-queue";
import { backfillSemanticOverlay as backfillSemanticOverlayProcedure } from "$capabilities/semantic-overlay/api/backfill-semantic-overlay/backfill-semantic-overlay";
import { enqueueSemanticSync as enqueueSemanticSyncProcedure } from "$capabilities/semantic-overlay/api/enqueue-semantic-sync/enqueue-semantic-sync";
import { querySemanticMaterials as querySemanticMaterialsProcedure } from "$capabilities/semantic-overlay/api/query-semantic-materials/query-semantic-materials";
import { readSemanticStatus as readSemanticStatusProcedure } from "$capabilities/semantic-overlay/api/read-semantic-status/read-semantic-status";
import { retireSemanticResource as retireSemanticResourceProcedure } from "$capabilities/semantic-overlay/api/retire-semantic-resource/retire-semantic-resource";

export const querySemanticOverlay = query("unchecked", querySemanticOverlayProcedure);
export const rebuildSemanticIndex = command("unchecked", rebuildSemanticIndexProcedure);
export const readSemanticResource = query("unchecked", readSemanticResourceProcedure);
export const syncSemanticResource = command("unchecked", syncSemanticResourceProcedure);
export const processSemanticSyncQueue = command("unchecked", processSemanticSyncQueueProcedure);
export const backfillSemanticOverlay = command("unchecked", backfillSemanticOverlayProcedure);
export const enqueueSemanticSync = command("unchecked", enqueueSemanticSyncProcedure);
export const querySemanticMaterials = query("unchecked", querySemanticMaterialsProcedure);
export const readSemanticStatus = query("unchecked", readSemanticStatusProcedure);
export const retireSemanticResource = command("unchecked", retireSemanticResourceProcedure);

export type {
  QuerySemanticOverlayInput,
  QuerySemanticOverlayResult
} from "$capabilities/semantic-overlay/types/query-semantic-overlay";
export type {
  RebuildSemanticIndexInput,
  RebuildSemanticIndexResult
} from "$capabilities/semantic-overlay/types/rebuild-semantic-index";
export type {
  ReadSemanticResourceInput,
  ReadSemanticResourceResult
} from "$capabilities/semantic-overlay/types/read-semantic-resource";
export type {
  SyncSemanticResourceInput,
  SyncSemanticResourceResult
} from "$capabilities/semantic-overlay/types/sync-semantic-resource";
export type {
  BackfillSemanticOverlayInput,
  BackfillSemanticOverlayResult,
  ProcessSemanticSyncQueueInput,
  ProcessSemanticSyncQueueResult
} from "$capabilities/semantic-overlay/types/semantic-sync-queue";
export type {
  EnqueueSemanticSyncInput,
  EnqueueSemanticSyncResult
} from "$capabilities/semantic-overlay/types/enqueue-semantic-sync";
export type {
  QuerySemanticMaterialsInput,
  QuerySemanticMaterialsResult
} from "$capabilities/semantic-overlay/types/query-semantic-materials";
export type {
  ExactSemanticStatus,
  MaterialSemanticStatus,
  ReadSemanticStatusInput,
  ReadSemanticStatusResult,
  SemanticLaneState,
  SemanticLaneStatus
} from "$capabilities/semantic-overlay/types/read-semantic-status";
export type {
  RetireSemanticResourceInput,
  RetireSemanticResourceResult
} from "$capabilities/semantic-overlay/types/retire-semantic-resource";

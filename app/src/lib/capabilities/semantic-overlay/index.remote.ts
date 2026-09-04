import { command, query } from "$app/server";
import { querySemanticOverlay as querySemanticOverlayProcedure } from "$capabilities/semantic-overlay/api/query-semantic-overlay/query-semantic-overlay";
import { rebuildSemanticIndex as rebuildSemanticIndexProcedure } from "$capabilities/semantic-overlay/api/rebuild-semantic-index/rebuild-semantic-index";

export const querySemanticOverlay = query("unchecked", querySemanticOverlayProcedure);
export const rebuildSemanticIndex = command("unchecked", rebuildSemanticIndexProcedure);

export type {
  QuerySemanticOverlayInput,
  QuerySemanticOverlayResult
} from "$capabilities/semantic-overlay/types/query-semantic-overlay";
export type {
  RebuildSemanticIndexInput,
  RebuildSemanticIndexResult
} from "$capabilities/semantic-overlay/types/rebuild-semantic-index";

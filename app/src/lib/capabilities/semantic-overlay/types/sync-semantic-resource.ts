import type { ResourceRef } from "$representation/data/types/core/resource";
import type { ProviderUsage } from "$representation/data/types/semantic/translation";
import type { RebuildSemanticIndexResult } from "$capabilities/semantic-overlay/types/rebuild-semantic-index";

export type SyncSemanticResourceInput = {
  readonly ref: ResourceRef;
  /** Re-project an already current revision, used by controlled backfills. */
  readonly force?: boolean;
};

export type SyncSemanticResourceResult =
  | {
      readonly outcome: "missing";
      readonly ref: ResourceRef;
    }
  | {
      readonly outcome: "current" | "superseded";
      readonly ref: ResourceRef;
      readonly revision: number;
      readonly overlayGeneration: number;
      readonly objectCount: number;
      readonly usage: readonly ProviderUsage[];
    }
  | {
      readonly outcome: "published";
      readonly ref: ResourceRef;
      readonly revision: number;
      readonly overlayGeneration: number;
      readonly objectCount: number;
      readonly index: RebuildSemanticIndexResult;
      readonly usage: readonly ProviderUsage[];
    };

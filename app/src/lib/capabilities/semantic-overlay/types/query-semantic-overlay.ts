import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type {
  RecursiveQueryDiagnostics,
  SemanticHit
} from "$representation/data/types/semantic/index";
import type { ProviderUsage } from "$representation/data/types/semantic/translation";

export type QuerySemanticOverlayInput = {
  readonly text: string;
  readonly scope?: ResourceSet;
  readonly topK: number;
};

export type QuerySemanticOverlayResult = {
  readonly overlayGeneration: number;
  readonly hits: SemanticHit[];
  readonly usage: ProviderUsage[];
  readonly diagnostics: RecursiveQueryDiagnostics;
};

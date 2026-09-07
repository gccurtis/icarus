import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type { MaterialHit, MaterialKind } from "$representation/data/types/semantic/material";
import type { RecursiveQueryDiagnostics } from "$representation/data/types/semantic/index";
import type { ProviderUsage } from "$representation/data/types/semantic/translation";

export type QuerySemanticMaterialsInput = {
  text: string;
  scope?: ResourceSet;
  kinds?: MaterialKind[];
  topK?: number;
};

export type QuerySemanticMaterialsResult = {
  overlayGeneration: number;
  hits: MaterialHit[];
  usage: ProviderUsage[];
  diagnostics: RecursiveQueryDiagnostics;
};

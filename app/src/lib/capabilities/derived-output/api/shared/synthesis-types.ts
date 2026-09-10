import type { ServerModel } from "$runtime/server/start.server";
import type {
  IntelligenceModel,
  IntelligenceTool,
  IntelligenceUsage
} from "$model/server/intelligence/index.server";
import type {
  DerivedOutput,
  DerivedOutputSelection,
  DerivedVariableResolution,
  MaterialDescriptorCitation,
  MaterialNativeCitation,
  SemanticCitation,
  SemanticTextCitation
} from "$representation/data/types/semantic/derived-output";
import type { ProviderUsage } from "$representation/data/types/semantic/translation";
import type {
  QuerySemanticMaterialsInput,
  QuerySemanticMaterialsResult,
  QuerySemanticOverlayInput,
  QuerySemanticOverlayResult
} from "$capabilities/semantic-overlay/index.remote";

export type SynthesisAttempt = {
  readonly status: "answered" | "insufficient";
  readonly text: string;
  readonly queries: string[];
  readonly overlayGenerations: number[];
  readonly evidence: SemanticCitation[];
  readonly variables?: DerivedVariableResolution[];
  readonly embeddingUsage: ProviderUsage[];
  readonly intelligenceUsage: IntelligenceUsage;
  readonly toolCalls: number;
};

export type ReadingInput = {
  readonly model: ServerModel;
  readonly selection?: DerivedOutputSelection;
  queryMaterials(input: QuerySemanticMaterialsInput): Promise<QuerySemanticMaterialsResult>;
};

export type SynthesisInput = {
  readonly output: DerivedOutput;
  readonly intelligence: IntelligenceModel;
  readonly defaultTopK: number;
  readonly signal?: AbortSignal;
  readonly reading?: ReadingInput;
  query(input: QuerySemanticOverlayInput): Promise<QuerySemanticOverlayResult>;
};

export type EvidenceDraft =
  | Omit<SemanticTextCitation, "selections">
  | Omit<MaterialDescriptorCitation, "selections">
  | Omit<MaterialNativeCitation, "selections">;

export type EvidenceSelection = { evidenceId: string; use: string };

export type AttemptEnvironment = {
  tools: IntelligenceTool[];
  issued: Map<string, EvidenceDraft>;
  queries: string[];
  overlayGenerations: number[];
  embeddingUsage: ProviderUsage[];
  firstTool: string;
};

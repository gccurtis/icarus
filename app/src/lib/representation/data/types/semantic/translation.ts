import type { SemanticSpan } from "$representation/data/types/semantic/overlay";
import type { SemanticSourceInput } from "$representation/data/types/semantic/source";

/** Tuning for the single distance-discounted-attraction segmentation policy. */
export type TranslationConfiguration = {
  maxTokens: number;
  minTokens: number;
  changeThreshold: number;
  basinProminenceThreshold: number;
  basinMassFraction: number;
  attractionDecayTokens: number;
  attractionStationaryThreshold: number;
};

/** Contextual token labels and their vector rows returned by the provider. */
export type TokenEmbeddingField = {
  labels: string[];
  vectors: number[][];
};

/** One exact source atom backed by one or more provider token vectors. */
export type AlignedTokenSpan = {
  from: number;
  to: number;
  modelTokens: number;
};

/** A provider field after its labels have been aligned to source coordinates. */
export type AlignedTokenField = {
  spans: AlignedTokenSpan[];
  vectors: number[][];
};

/** A half-open range over aligned token spans, not source coordinates. */
export type SegmentRange = {
  fromSpan: number;
  toSpan: number;
};

/** The two values from a candidate boundary used by the attraction equation. */
export type AttractionPoint = {
  boundaryPositionTokens: number;
  semanticChange: number;
};

/** Provider accounting passed through the translation boundary for telemetry. */
export type ProviderUsage = {
  operation: "tokenField" | "denseVectors";
  api: string;
  model: string;
  requestCount: number;
  inputItems: number;
  inputTokens?: number;
  costUsd?: number;
  requestId?: string;
};

/** The provider-free result of alignment and segmentation. */
export type PreparedTranslation = {
  source: SemanticSourceInput;
  aligned: AlignedTokenField;
  ranges: SegmentRange[];
  spans: SemanticSpan[];
};

/** A semantic object value awaiting stored row identity. */
export type SemanticObjectDraft = {
  span: SemanticSpan;
  vector: number[];
};

/** The transient publication message produced after final vectors arrive. */
export type TranslationResult = {
  source: SemanticSourceInput;
  objects: SemanticObjectDraft[];
  usage: ProviderUsage[];
};

/** Metrics for one local peak in the candidate-boundary field. */
export type AttractionPeak = {
  candidateIndex: number;
  boundarySpan: number;
  boundaryPositionTokens: number;
  sourceOffset: number;
  semanticChange: number;
  basinMass: number;
  massFraction: number;
  prominence: number;
  signedPull: number;
  stationary: boolean;
  eligible: boolean;
  selected: boolean;
};

/** Inspectable deterministic output used by tests and development tooling. */
export type SegmentationResult = {
  ranges: SegmentRange[];
  peaks: AttractionPeak[];
};

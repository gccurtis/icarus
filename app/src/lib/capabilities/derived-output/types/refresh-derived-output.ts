import type { Id } from "$representation/data/types/core/id";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";
import type { ProviderUsage } from "$representation/data/types/semantic/translation";
import type { DerivedOutputSelection } from "$representation/data/types/semantic/derived-output";

export type RefreshDerivedOutputInput = {
  readonly derivedOutputId: Id<"derivedOutputs">;
  readonly selection?: DerivedOutputSelection;
};

export type DerivedSynthesisUsage = {
  readonly providerRequests: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly reasoningTokens?: number;
  readonly costUsd?: number;
  readonly embeddings: ProviderUsage[];
};

export type RefreshDerivedOutputResult = {
  readonly outcome: "current" | "published" | "failed" | "superseded";
  readonly output: DerivedOutput;
  readonly attempts: number;
  readonly toolCalls: number;
  readonly usage: DerivedSynthesisUsage;
} | null;

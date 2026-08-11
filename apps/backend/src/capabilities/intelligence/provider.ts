import type { ToolCall, ToolDefinition } from "#capabilities/intelligence/tools.js";
import type { IntelligenceTier, Message, Usage } from "#capabilities/intelligence/types.js";

export interface ProviderInferenceRequest {
  model: string;
  messages: Message[];
  effort?: IntelligenceTier;
  schema?: Record<string, unknown>;
}

export interface ProviderInferenceResponse {
  content: string;
  usage: Usage;
}

export interface ProviderReasoningRequest {
  model: string;
  messages: Message[];
  effort?: IntelligenceTier;
  schema?: Record<string, unknown>;
  tools?: ToolDefinition[];
}

export interface ProviderReasoningResponse {
  content: string;
  toolCalls: ToolCall[];
  usage: Usage;
}

export interface ProviderEmbedRequest {
  model: string;
  inputs: string[];
}

export interface ProviderEmbedResponse {
  vectors: number[][];
  usage: Usage;
}

export interface Provider {
  name(): string;
  infer(signal: AbortSignal | undefined, req: ProviderInferenceRequest): Promise<ProviderInferenceResponse>;
  reason(signal: AbortSignal | undefined, req: ProviderReasoningRequest): Promise<ProviderReasoningResponse>;
  embed(signal: AbortSignal | undefined, req: ProviderEmbedRequest): Promise<ProviderEmbedResponse>;
}

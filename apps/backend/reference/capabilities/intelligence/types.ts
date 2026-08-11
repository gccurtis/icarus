export type IntelligenceTier = "low" | "medium" | "high";

export interface Cast {
  purpose: string;
  strength: IntelligenceTier;
  speed: IntelligenceTier;
}

export interface CastRoute {
  purpose: string;
  strength: IntelligenceTier;
  speed: IntelligenceTier;
  provider: string;
  model: string;
  effort?: IntelligenceTier;
}

export interface OpenRouterProviderConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
}

export interface IntelligenceConfig {
  providers: {
    openrouter: OpenRouterProviderConfig;
  };
  inference: {
    routes: CastRoute[];
  };
  reasoning: {
    routes: CastRoute[];
  };
  embedding: {
    provider: string;
    model: string;
  };
}

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: MessageRole;
  content?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  toolCallId?: string;
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  costUsd?: number; // populated when the provider returns pricing data
}

export interface InferRequest {
  cast: Cast;
  messages: Message[];
}

export interface ReasonRequest {
  cast: Cast;
  messages: Message[];
}

export interface EmbedRequest {
  inputs: string[];
}

export interface TextResult {
  text: string;
  usage: Usage;
}

export interface StructuredResult {
  structured: unknown;
  usage: Usage;
}

export interface EmbedResult {
  vectors: number[][];
  provider: string;
  model: string;
  usage: Usage;
}

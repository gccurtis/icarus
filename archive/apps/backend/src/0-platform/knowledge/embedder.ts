import type { Usage } from "#platform/intelligence/types.js";
import type { Intelligence } from "#platform/intelligence/intelligence.js";

/** The narrow port Knowledge uses to get embeddings. */
export interface Embedder {
  embed(inputs: string[]): Promise<{ vectors: number[][]; usage: Usage }>;
}

/**
 * Wraps an Intelligence instance as an Embedder. AbortSignal is undefined for
 * now — wire it through when request-level cancellation is added.
 */
export class IntelligenceEmbedder implements Embedder {
  constructor(private readonly intelligence: Intelligence) {}

  async embed(inputs: string[]): Promise<{ vectors: number[][]; usage: Usage }> {
    const result = await this.intelligence.embed(undefined, { inputs });
    return { vectors: result.vectors, usage: result.usage };
  }
}

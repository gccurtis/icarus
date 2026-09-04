import type { EmbeddingSpace } from "$representation/data/types/semantic/overlay";
import type { TokenEmbeddingField } from "$representation/data/types/semantic/translation";
import {
  embedPassages,
  embedQuery,
  embedTokenField
} from "$model/server/embedding/methods/embed";
import type {
  EmbeddingInput,
  EmbeddingModel,
  EmbeddingResult,
  EmbeddingState
} from "$model/server/embedding/types";

/** One immutable Jina configuration and the transport used to reach it. */
export class JinaEmbedding implements EmbeddingModel {
  readonly space: EmbeddingSpace;
  readonly #state: EmbeddingState;

  constructor(input: EmbeddingInput) {
    this.#state = { ...input, request: input.request ?? globalThis.fetch };
    this.space = {
      provider: "jina",
      model: input.model,
      dimensions: input.dimensions
    };
  }

  tokenField(text: string): Promise<EmbeddingResult<TokenEmbeddingField>> {
    return embedTokenField(this.#state, text);
  }

  passages(texts: readonly string[]): Promise<EmbeddingResult<number[][]>> {
    return embedPassages(this.#state, texts);
  }

  query(text: string): Promise<EmbeddingResult<number[]>> {
    return embedQuery(this.#state, text);
  }
}

export const defineEmbedding = (input: EmbeddingInput): EmbeddingModel =>
  new JinaEmbedding(input);

import type { EmbeddingSpace } from "$representation/data/types/semantic/overlay";
import type { TokenEmbeddingField } from "$representation/data/types/semantic/translation";
import {
  image,
  passage,
  passages,
  query,
  tokenField,
  windowedPassages
} from "$model/server/embedding/methods/embed";
import type {
  EmbeddingInput,
  ImageEmbeddingInput,
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
    return tokenField(this.#state, text);
  }

  windowedPassages(texts: readonly string[]): Promise<EmbeddingResult<number[][]>> {
    return windowedPassages(this.#state, texts);
  }

  passage(text: string): Promise<EmbeddingResult<number[]>> {
    return passage(this.#state, text);
  }

  passages(texts: readonly string[]): Promise<EmbeddingResult<number[][]>> {
    return passages(this.#state, texts);
  }

  image(input: ImageEmbeddingInput): Promise<EmbeddingResult<number[]>> {
    return image(this.#state, input);
  }

  query(text: string): Promise<EmbeddingResult<number[]>> {
    return query(this.#state, text);
  }
}

export const defineEmbedding = (input: EmbeddingInput): EmbeddingModel =>
  new JinaEmbedding(input);

import type { EmbeddingSpace } from "$representation/data/types/semantic/overlay";
import type {
  ProviderUsage,
  TokenEmbeddingField
} from "$representation/data/types/semantic/translation";

export type EmbeddingResult<Value> = {
  readonly value: Value;
  readonly usage: ProviderUsage;
};

export type ImageEmbeddingInput =
  | { readonly kind: "url"; readonly url: string }
  | { readonly kind: "bytes"; readonly base64: string; readonly mediaType?: string };

/** The process-wide embedding port. Credentials never cross this boundary. */
export interface EmbeddingModel {
  readonly space: EmbeddingSpace;
  tokenField(text: string): Promise<EmbeddingResult<TokenEmbeddingField>>;
  /** Contextual vectors for spans from exactly one source document. */
  windowedPassages(texts: readonly string[]): Promise<EmbeddingResult<number[][]>>;
  /** One non-contextual vector for one complete passage. */
  passage(text: string): Promise<EmbeddingResult<number[]>>;
  /** Independent non-contextual vectors for unrelated complete passages. */
  passages(texts: readonly string[]): Promise<EmbeddingResult<number[][]>>;
  /** One original image in the same retrieval.passage vector space as text. */
  image(input: ImageEmbeddingInput): Promise<EmbeddingResult<number[]>>;
  query(text: string): Promise<EmbeddingResult<number[]>>;
}

/** Injected transport keeps HTTP deterministic in unit tests. */
export type EmbeddingRequest = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

/** Private constructor state for the Jina implementation. */
export type EmbeddingInput = {
  readonly apiKey: string;
  readonly endpoint: string;
  readonly model: string;
  readonly dimensions: number;
  readonly timeoutMs: number;
  readonly request?: EmbeddingRequest;
};

export type EmbeddingState = Required<EmbeddingInput>;

export class EmbeddingServiceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EmbeddingServiceError";
  }
}

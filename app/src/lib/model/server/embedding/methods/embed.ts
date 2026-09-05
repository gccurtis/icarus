import type {
  ProviderUsage,
  TokenEmbeddingField
} from "$representation/data/types/semantic/translation";
import {
  EmbeddingServiceError,
  type EmbeddingResult,
  type EmbeddingState
} from "$model/server/embedding/types";
import {
  isObject,
  requestJina,
  type JinaResponse
} from "$model/server/embedding/methods/request";

type Operation = ProviderUsage["operation"];

const requiredTexts = (texts: readonly string[], label: string): string[] => {
  if (texts.length === 0) throw new Error(`${label} requires at least one text`);
  if (texts.some((text) => typeof text !== "string" || text.length === 0)) {
    throw new Error(`${label} texts must not be empty`);
  }
  return [...texts];
};

const finiteVector = (value: unknown, dimensions?: number): number[] => {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    (dimensions !== undefined && value.length !== dimensions) ||
    value.some((entry) => typeof entry !== "number" || !Number.isFinite(entry))
  ) {
    throw new EmbeddingServiceError(
      `Jina embeddings returned an invalid${dimensions ? ` ${dimensions}-dimensional` : ""} vector`
    );
  }
  return value as number[];
};

const orderedData = (
  response: JinaResponse,
  expected: number
): Record<string, unknown>[] => {
  const data = response.body.data;
  if (!Array.isArray(data) || data.length !== expected || data.some((item) => !isObject(item))) {
    throw new EmbeddingServiceError("Jina embeddings returned invalid data rows");
  }
  const ordered = [...(data as Record<string, unknown>[])].sort(
    (left, right) => Number(left.index) - Number(right.index)
  );
  if (ordered.some((item, index) => item.index !== index)) {
    throw new EmbeddingServiceError("Jina embeddings response indices do not match the request");
  }
  return ordered;
};

const usage = (
  state: EmbeddingState,
  response: JinaResponse,
  operation: Operation,
  inputItems: number
): ProviderUsage => {
  const source = isObject(response.body.usage) ? response.body.usage : undefined;
  const inputTokens = source?.prompt_tokens ?? source?.total_tokens;
  return {
    operation,
    api: "jina",
    model: state.model,
    requestCount: 1,
    inputItems,
    ...(typeof inputTokens === "number" && Number.isFinite(inputTokens)
      ? { inputTokens }
      : {}),
    ...(response.requestId ? { requestId: response.requestId } : {})
  };
};

const dense = async (
  state: EmbeddingState,
  texts: readonly string[],
  task: "retrieval.passage" | "retrieval.query",
  operation: Operation,
  lateChunking: boolean
): Promise<EmbeddingResult<number[][]>> => {
  const input = requiredTexts(texts, operation);
  const response = await requestJina(state, {
    model: state.model,
    input,
    task,
    dimensions: state.dimensions,
    embedding_type: "float",
    truncate: false,
    ...(lateChunking ? { late_chunking: true } : {})
  });
  const value = orderedData(response, input.length).map((item) =>
    finiteVector(item.embedding, state.dimensions)
  );
  return { value, usage: usage(state, response, operation, input.length) };
};

/** Contextual token rows used only for boundary detection. */
export const embedTokenField = async (
  state: EmbeddingState,
  text: string
): Promise<EmbeddingResult<TokenEmbeddingField>> => {
  requiredTexts([text], "tokenField");
  const response = await requestJina(state, {
    model: state.model,
    input: [text],
    task: "retrieval.passage",
    return_multivector: true,
    return_tokenized_input: true,
    embedding_type: "float",
    truncate: false
  });
  const [row] = orderedData(response, 1);
  const labels = row.tokenized_input;
  const embeddings = row.embeddings;
  if (!Array.isArray(labels) || labels.some((label) => typeof label !== "string")) {
    throw new EmbeddingServiceError("Jina embeddings returned invalid token labels");
  }
  if (!Array.isArray(embeddings) || embeddings.length !== labels.length) {
    throw new EmbeddingServiceError("Jina embeddings returned misaligned token vectors");
  }
  const vectors = embeddings.map((vector) => finiteVector(vector));
  const dimensions = vectors[0]?.length;
  if (dimensions === undefined || vectors.some((vector) => vector.length !== dimensions)) {
    throw new EmbeddingServiceError("Jina embeddings returned inconsistent token dimensions");
  }
  return {
    value: { labels: labels as string[], vectors },
    usage: usage(state, response, "tokenField", 1)
  };
};

/** Final spans from one source are contextualized together through late chunking. */
export const embedWindowedPassages = (
  state: EmbeddingState,
  texts: readonly string[]
): Promise<EmbeddingResult<number[][]>> =>
  dense(state, texts, "retrieval.passage", "windowedPassageVectors", true);

/** One complete passage receives one vector without contextual late chunking. */
export const embedPassage = async (
  state: EmbeddingState,
  text: string
): Promise<EmbeddingResult<number[]>> => {
  const result = await dense(state, [text], "retrieval.passage", "passageVector", false);
  return { value: result.value[0], usage: result.usage };
};

/** A query is embedded on the asymmetric query side of the same vector space. */
export const embedQuery = async (
  state: EmbeddingState,
  text: string
): Promise<EmbeddingResult<number[]>> => {
  if (!text.trim()) throw new Error("query text must not be blank");
  const result = await dense(state, [text], "retrieval.query", "queryVector", false);
  return { value: result.value[0], usage: result.usage };
};

import {
  EmbeddingServiceError,
  type EmbeddingState
} from "$model/server/embedding/types";

type JsonObject = Record<string, unknown>;

export type JinaResponse = {
  readonly body: JsonObject;
  readonly requestId?: string;
};

export const isObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const errorDetail = (body: unknown): string | undefined => {
  if (!isObject(body)) return undefined;
  const candidate = body.detail ?? body.message;
  if (typeof candidate === "string" && candidate.length > 0) {
    return candidate.slice(0, 300);
  }
  if (isObject(candidate) && typeof candidate.message === "string") {
    return candidate.message.slice(0, 300);
  }
  return undefined;
};

/** Authenticated JSON transport with a hard deadline and bounded errors. */
export const requestJina = async (
  state: EmbeddingState,
  payload: JsonObject
): Promise<JinaResponse> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), state.timeoutMs);

  let response: Response;
  try {
    response = await state.request(state.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${state.apiKey}`,
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    const reason = controller.signal.aborted
      ? `timed out after ${state.timeoutMs}ms`
      : "could not be reached";
    throw new EmbeddingServiceError(`Jina embeddings ${reason}`, { cause: error });
  } finally {
    clearTimeout(timeout);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new EmbeddingServiceError(
      `Jina embeddings returned non-JSON HTTP ${response.status}`,
      { cause: error }
    );
  }

  if (!response.ok) {
    const detail = errorDetail(body);
    throw new EmbeddingServiceError(
      `Jina embeddings returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`
    );
  }
  if (!isObject(body)) {
    throw new EmbeddingServiceError("Jina embeddings returned a non-object response");
  }

  const requestId = response.headers.get("x-request-id") ?? undefined;
  return { body, ...(requestId ? { requestId } : {}) };
};

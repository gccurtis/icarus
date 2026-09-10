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
  payload: JsonObject,
  signal?: AbortSignal
): Promise<JinaResponse> => {
  signal?.throwIfAborted();
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, state.timeoutMs);

  let response: Response;
  let body: unknown;
  try {
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
      signal?.throwIfAborted();
      const reason = timedOut
        ? `timed out after ${state.timeoutMs}ms`
        : "could not be reached";
      throw new EmbeddingServiceError(`Jina embeddings ${reason}`, { cause: error });
    }
    signal?.throwIfAborted();
    try {
      body = await response.json();
    } catch (error) {
      signal?.throwIfAborted();
      if (timedOut) {
        throw new EmbeddingServiceError(
          `Jina embeddings timed out after ${state.timeoutMs}ms`,
          { cause: error }
        );
      }
      throw new EmbeddingServiceError(
        `Jina embeddings returned non-JSON HTTP ${response.status}`,
        { cause: error }
      );
    }
    signal?.throwIfAborted();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
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

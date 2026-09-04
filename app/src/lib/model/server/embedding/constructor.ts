import {
  requiredString,
  type Configuration
} from "$model/server/configuration/index.server";
import { defineEmbedding } from "$model/server/embedding/definition";
import type { EmbeddingModel } from "$model/server/embedding/types";

const ROOT = "semanticOverlay.embedding";
const JINA = `${ROOT}.jina`;

const requiredPositiveInteger = (configuration: Configuration, key: string): number => {
  const value = configuration.get(key);
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new Error(`Configuration key '${key}' must be a positive integer`);
  }
  return value as number;
};

const requiredEndpoint = (configuration: Configuration): string => {
  const endpoint = requiredString(configuration, `${JINA}.endpoint`);
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch (error) {
    throw new Error(`Configuration key '${JINA}.endpoint' must be an HTTP URL`, {
      cause: error
    });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Configuration key '${JINA}.endpoint' must be an HTTP URL`);
  }
  return parsed.toString();
};

/** Validates the complete provider contract before the server begins serving. */
export const createEmbedding = (configuration: Configuration): EmbeddingModel => {
  const api = requiredString(configuration, `${ROOT}.api`);
  if (api !== "jina") {
    throw new Error(`Configuration key '${ROOT}.api' must be 'jina'`);
  }

  const model = requiredString(configuration, `${JINA}.model`);
  if (model !== "jina-embeddings-v4") {
    throw new Error(
      `Configuration key '${JINA}.model' must be 'jina-embeddings-v4' while token fields use its multivector contract`
    );
  }

  const dimensions = requiredPositiveInteger(configuration, `${JINA}.dimensions`);
  if (dimensions > 2048) {
    throw new Error(`Configuration key '${JINA}.dimensions' must not exceed 2048`);
  }

  return defineEmbedding({
    apiKey: requiredString(configuration, `${JINA}.apiKey`),
    endpoint: requiredEndpoint(configuration),
    model,
    dimensions,
    timeoutMs: requiredPositiveInteger(configuration, `${JINA}.timeoutMs`)
  });
};

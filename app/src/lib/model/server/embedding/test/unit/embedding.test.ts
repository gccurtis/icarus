import assert from "node:assert/strict";
import { test } from "vitest";
import { createEmbedding } from "$model/server/embedding/constructor";
import { defineEmbedding } from "$model/server/embedding/definition";

const response = (data: unknown, requestId = "request-1"): Response =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { "content-type": "application/json", "x-request-id": requestId }
  });

const input = (request: typeof fetch) => ({
  apiKey: "secret-for-tests",
  endpoint: "https://api.jina.ai/v1/embeddings",
  model: "jina-embeddings-v4",
  dimensions: 3,
  timeoutMs: 1000,
  request
});

test("source-local windowed passage vectors use late chunking and restore response order", async () => {
  let payload: Record<string, unknown> | undefined;
  let authorization: string | null = null;
  const embedding = defineEmbedding(
    input(async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      authorization = new Headers(init?.headers).get("authorization");
      return response({
        data: [
          { index: 1, embedding: [0, 1, 0] },
          { index: 0, embedding: [1, 0, 0] }
        ],
        usage: { prompt_tokens: 7, total_tokens: 7 }
      });
    })
  );

  const result = await embedding.windowedPassages(["first", "second"]);

  assert.deepEqual(result.value, [[1, 0, 0], [0, 1, 0]]);
  assert.deepEqual(payload, {
    model: "jina-embeddings-v4",
    input: ["first", "second"],
    task: "retrieval.passage",
    dimensions: 3,
    embedding_type: "float",
    truncate: false,
    late_chunking: true
  });
  assert.equal(authorization, "Bearer secret-for-tests");
  assert.deepEqual(result.usage, {
    operation: "windowedPassageVectors",
    api: "jina",
    model: "jina-embeddings-v4",
    requestCount: 1,
    inputItems: 2,
    inputTokens: 7,
    requestId: "request-1"
  });
});

test("a complete passage produces one retrieval vector without late chunking", async () => {
  let payload: Record<string, unknown> | undefined;
  const embedding = defineEmbedding(
    input(async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      return response({ data: [{ index: 0, embedding: [1, 0, 0] }], usage: { total_tokens: 4 } });
    })
  );

  const result = await embedding.passage("one complete passage");

  assert.deepEqual(result.value, [1, 0, 0]);
  assert.deepEqual(payload, {
    model: "jina-embeddings-v4",
    input: ["one complete passage"],
    task: "retrieval.passage",
    dimensions: 3,
    embedding_type: "float",
    truncate: false
  });
  assert.equal(result.usage.operation, "passageVector");
  await assert.rejects(() => embedding.passage(""), /must not be empty/);
});

test("query vectors use retrieval.query without late chunking", async () => {
  let payload: Record<string, unknown> | undefined;
  const embedding = defineEmbedding(
    input(async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      return response({ data: [{ index: 0, embedding: [0, 0, 1] }], usage: { total_tokens: 2 } });
    })
  );

  const result = await embedding.query("where is it?");

  assert.deepEqual(result.value, [0, 0, 1]);
  assert.equal(payload?.task, "retrieval.query");
  assert.equal(Object.hasOwn(payload ?? {}, "late_chunking"), false);
  assert.equal(result.usage.operation, "queryVector");
  await assert.rejects(() => embedding.query("   "), /must not be blank/);
});

test("images use a typed multimodal input in the shared passage space", async () => {
  let payload: Record<string, unknown> | undefined;
  const embedding = defineEmbedding(
    input(async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      return response({ data: [{ index: 0, embedding: [0, 1, 0] }], usage: {} });
    })
  );

  const result = await embedding.image({ kind: "url", url: "https://example.test/chart.png" });

  assert.deepEqual(payload, {
    model: "jina-embeddings-v4",
    input: [{ image: "https://example.test/chart.png" }],
    task: "retrieval.passage",
    dimensions: 3,
    embedding_type: "float",
    truncate: false
  });
  assert.deepEqual(result.value, [0, 1, 0]);
  assert.equal(result.usage.operation, "imageVector");
  await assert.rejects(() => embedding.image({ kind: "url", url: "file:///tmp/x.png" }), /HTTP or HTTPS/);
  await assert.rejects(() => embedding.image({ kind: "bytes", base64: "" }), /must not be blank/);
});

test("token fields request v4 multivectors and matching labels", async () => {
  let payload: Record<string, unknown> | undefined;
  const embedding = defineEmbedding(
    input(async (_url, init) => {
      payload = JSON.parse(String(init?.body));
      return response({
        data: [
          {
            index: 0,
            tokenized_input: ["one", " two"],
            embeddings: [[1, 0], [0, 1]]
          }
        ],
        usage: { prompt_tokens: 2, total_tokens: 2 }
      });
    })
  );

  const result = await embedding.tokenField("one two");

  assert.deepEqual(result.value, {
    labels: ["one", " two"],
    vectors: [[1, 0], [0, 1]]
  });
  assert.equal(payload?.return_multivector, true);
  assert.equal(payload?.return_tokenized_input, true);
  assert.equal(Object.hasOwn(payload ?? {}, "dimensions"), false);
});

test("malformed provider responses fail without exposing the credential", async () => {
  const embedding = defineEmbedding(
    input(async () => response({ data: [{ index: 0, embedding: [1, 0] }], usage: {} }))
  );

  await assert.rejects(
    () => embedding.query("test"),
    (error: Error) => {
      assert.match(error.message, /3-dimensional vector/);
      assert.doesNotMatch(error.message, /secret-for-tests/);
      return true;
    }
  );
});

test("HTTP errors are bounded and carry the provider status", async () => {
  const embedding = defineEmbedding(
    input(async () =>
      new Response(JSON.stringify({ detail: "invalid request" }), {
        status: 422,
        headers: { "content-type": "application/json" }
      })
    )
  );

  await assert.rejects(() => embedding.query("test"), /HTTP 422: invalid request/);
});

test("a caller abort reaches the active Jina request", async () => {
  let providerSignal: AbortSignal | undefined;
  let entered!: () => void;
  const active = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const embedding = defineEmbedding(
    input(async (_url, init) => {
      const signal = init?.signal;
      assert.ok(signal instanceof AbortSignal);
      providerSignal = signal;
      entered();
      await new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true
        });
      });
      throw new Error("unreachable");
    })
  );
  const controller = new AbortController();
  const pending = embedding.query("interrupt this", controller.signal);
  await active;

  controller.abort();

  await assert.rejects(pending, (error: Error) => error.name === "AbortError");
  assert.equal(providerSignal?.aborted, true);
});

test("a caller abort remains attached while the provider response body is read", async () => {
  let entered!: () => void;
  const reading = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const embedding = defineEmbedding(
    input(async (_url, init) => ({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => {
        const signal = init?.signal;
        assert.ok(signal instanceof AbortSignal);
        entered();
        await new Promise<never>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      }
    }) as Response)
  );
  const controller = new AbortController();
  const pending = embedding.query("interrupt the response body", controller.signal);
  await reading;

  controller.abort();

  await assert.rejects(pending, (error: Error) => error.name === "AbortError");
});

test("constructor validates the complete Jina coordinate space", () => {
  const values: Record<string, unknown> = {
    "semanticOverlay.embedding.api": "jina",
    "semanticOverlay.embedding.jina.apiKey": "key",
    "semanticOverlay.embedding.jina.endpoint": "https://api.jina.ai/v1/embeddings",
    "semanticOverlay.embedding.jina.model": "jina-embeddings-v4",
    "semanticOverlay.embedding.jina.dimensions": 512,
    "semanticOverlay.embedding.jina.timeoutMs": 90_000
  };
  const configuration = { get: (key: string) => values[key] };

  assert.deepEqual(createEmbedding(configuration).space, {
    provider: "jina",
    model: "jina-embeddings-v4",
    dimensions: 512
  });
  values["semanticOverlay.embedding.jina.dimensions"] = 0;
  assert.throws(() => createEmbedding(configuration), /positive integer/);
  values["semanticOverlay.embedding.jina.dimensions"] = 512;
  values["semanticOverlay.embedding.jina.model"] = "another-model";
  assert.throws(() => createEmbedding(configuration), /jina-embeddings-v4/);
});

#!/usr/bin/env node
import { createServer } from "node:http";

import {
  DERIVED_QUERY,
  TARGET_SENTENCE,
  derivedDecisionFor,
  embeddingFor
} from "./browser-provider-evidence.mjs";

const HOST = "127.0.0.1";
const PORT = Number(process.argv[2] ?? process.env.ICARUS_BROWSER_PROVIDER_PORT);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65_535) {
  throw new Error("browser-provider-fixture: expected a valid port");
}
const MAX_BODY_BYTES = 1_000_000;

let requestNumber = 0;
const calls = { jina: 0, openrouter: 0 };
const barrier = { held: false, waiting: 0, releases: [] };

const json = (response, status, body) => {
  response.writeHead(status, {
    "content-type": "application/json",
    "x-request-id": `browser-provider-${requestNumber}`
  });
  response.end(JSON.stringify(body));
};

const readBody = async (request) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("request body exceeds fixture limit");
    chunks.push(chunk);
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("request body must be a JSON object");
  }
  return parsed;
};

const providerTurn = (message) => ({
  choices: [{ index: 0, finish_reason: "tool_calls", message }],
  usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 }
});

const completionTurn = (content) => ({
  choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
  usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 }
});

const toolNames = (body) =>
  (Array.isArray(body.tools) ? body.tools : [])
    .map((tool) => tool?.function?.name)
    .filter((name) => typeof name === "string");

const toolResult = (body) => {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const message = [...messages].reverse().find((entry) => entry?.role === "tool");
  if (typeof message?.content !== "string") return undefined;
  const parsed = JSON.parse(message.content);
  return parsed?.ok === true ? parsed.value : undefined;
};

const latestQuestion = (body) => {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const message = [...messages].reverse().find((entry) => entry?.role === "user");
  if (typeof message?.content === "string") return message.content;
  if (!Array.isArray(message?.content)) return "";
  return message.content
    .map((part) => (part?.type === "text" && typeof part.text === "string" ? part.text : ""))
    .join(" ");
};

const barrierState = () => ({ held: barrier.held, waiting: barrier.waiting });

const holdBarrier = () => {
  if (barrier.waiting !== 0) throw new Error("cannot hold the provider barrier while a call waits");
  barrier.held = true;
};

const releaseBarrier = () => {
  barrier.held = false;
  for (const release of barrier.releases.splice(0)) release();
};

const waitAtBarrier = async () => {
  if (!barrier.held) return;
  barrier.waiting += 1;
  try {
    await new Promise((resolve) => barrier.releases.push(resolve));
  } finally {
    barrier.waiting -= 1;
  }
};

const researchTurn = async (body) => {
  const result = toolResult(body);
  const question = latestQuestion(body).toLowerCase();
  const asksArithmetic =
    question.includes("five apples") &&
    question.includes("two") &&
    (question.includes("left") || question.includes("remain"));
  if (result === undefined) {
    return providerTurn({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: `retrieve-${requestNumber}`,
          type: "function",
          function: {
            name: "retrieve",
            arguments: JSON.stringify({
              query: asksArithmetic ? "five apples take two away" : TARGET_SENTENCE,
              topK: 6
            })
          }
        }
      ]
    });
  }

  const passages = Array.isArray(result.passages) ? result.passages : [];
  const source = passages.find(
    (passage) =>
      typeof passage?.sourceId === "string" &&
      typeof passage?.text === "string" &&
      passage.text.toLowerCase().includes(TARGET_SENTENCE.toLowerCase())
  );
  const decision =
    asksArithmetic || source === undefined
      ? { status: "insufficient", sources: [], response: "", findings: [] }
      : {
          status: "answered",
          sources: [
            {
              sourceId: source.sourceId,
              use: "Identifies the binding winter constraint."
            }
          ],
          response: "The readiness brief identifies Substation 14 as the binding constraint.",
          findings: [
            {
              text: "Substation 14 is the binding winter constraint.",
              sourceIds: [source.sourceId]
            }
          ]
        };

  // The browser releases this only after it observes the persisted running turn.
  await waitAtBarrier();
  return providerTurn({
    role: "assistant",
    content: null,
    tool_calls: [
      {
        id: `submit-${requestNumber}`,
        type: "function",
        function: { name: "submit_answer", arguments: JSON.stringify(decision) }
      }
    ]
  });
};

/**
 * Deterministic grounded synthesis for browser-owned Derived Output tests.
 *
 * The first turn exercises the real `retrieve` tool. The second returns the
 * provider-enforced structured result using an evidence id issued by that tool,
 * so a browser assertion proves the selected Resource Set controlled retrieval
 * instead of merely proving that its pointer was persisted.
 */
const derivedOutputTurn = (body) => {
  const result = toolResult(body);
  if (result === undefined) {
    return providerTurn({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: `retrieve-${requestNumber}`,
          type: "function",
          function: {
            name: "retrieve",
            arguments: JSON.stringify({ query: DERIVED_QUERY, topK: 6 })
          }
        }
      ]
    });
  }

  const decision = derivedDecisionFor(result);
  return completionTurn(JSON.stringify(decision));
};

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/health") {
      return json(response, 200, { ok: true });
    }
    if (request.method === "GET" && request.url === "/state") {
      return json(response, 200, { calls, barrier: barrierState() });
    }
    if (request.method === "POST" && request.url === "/control/hold") {
      holdBarrier();
      return json(response, 200, { barrier: barrierState() });
    }
    if (request.method === "POST" && request.url === "/control/release") {
      releaseBarrier();
      return json(response, 200, { barrier: barrierState() });
    }
    if (request.method !== "POST") return json(response, 404, { error: "not found" });
    if (request.headers.authorization !== "Bearer browser-fixture-key") {
      return json(response, 401, { error: "fixture credential required" });
    }

    requestNumber += 1;
    const body = await readBody(request);

    if (request.url === "/jina") {
      calls.jina += 1;
      const input = Array.isArray(body.input) ? body.input : [];
      if (input.length === 0) throw new Error("embedding input must not be empty");
      return json(response, 200, {
        data: input.map((value, index) =>
          body.return_multivector === true
            ? {
                index,
                tokenized_input: ["Pass", "age", ":", String(value)],
                embeddings: [
                  [0, 0, 0, 0],
                  [0, 0, 0, 0],
                  [0, 0, 0, 0],
                  embeddingFor(value)
                ]
              }
            : { index, embedding: embeddingFor(value) }
        ),
        usage: { prompt_tokens: input.length, total_tokens: input.length }
      });
    }

    if (request.url === "/openrouter") {
      calls.openrouter += 1;
      const names = toolNames(body);
      if (names.includes("retrieve") && names.includes("submit_answer")) {
        return json(response, 200, await researchTurn(body));
      }
      if (
        names.includes("retrieve") &&
        body.response_format?.json_schema?.name === "semantic_derived_output"
      ) {
        return json(response, 200, derivedOutputTurn(body));
      }
      throw new Error(
        "the deterministic fixture accepts only research-chat and grounded Derived Output contracts"
      );
    }

    return json(response, 404, { error: "not found" });
  } catch (error) {
    return json(response, 400, {
      error: error instanceof Error ? error.message : "fixture request failed"
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`browser provider fixture listening on http://${HOST}:${PORT}`);
});

const close = () => {
  releaseBarrier();
  server.close(() => process.exit(0));
};
process.on("SIGTERM", close);
process.on("SIGINT", close);

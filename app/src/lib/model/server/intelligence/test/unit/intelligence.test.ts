import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { createIntelligence } from "$model/server/intelligence/constructor";
import { defineIntelligence } from "$model/server/intelligence/definition";

const response = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" }
  });

const turn = (
  message: Record<string, unknown>,
  usage: Record<string, unknown> = {}
): Record<string, unknown> => ({ choices: [{ message }], usage });

const input = (request: typeof fetch, maxToolRounds = 3) => ({
  apiKey: "secret-for-tests",
  endpoint: "https://openrouter.ai/api/v1/chat/completions",
  model: "~openai/gpt-latest",
  timeoutMs: 1_000,
  maxOutputTokens: 256,
  reasoningEffort: "medium" as const,
  maxToolRounds,
  request
});

const tool = (execute: (value: unknown) => Promise<unknown>) => ({
  name: "retrieve",
  description: "Find evidence",
  inputSchema: {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
    additionalProperties: false
  },
  execute
});

describe("OpenRouter intelligence", () => {
  it("forces the first tool, returns its result, and accumulates accounting", async () => {
    const payloads: Record<string, unknown>[] = [];
    let authorization: string | null = null;
    const replies = [
      turn(
        {
          content: null,
          tool_calls: [
            {
              id: "call-1",
              type: "function",
              function: { name: "retrieve", arguments: '{"query":"launch"}' }
            }
          ]
        },
        { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14, cost: 0.001 }
      ),
      turn(
        { content: "Grounded answer.", tool_calls: [] },
        {
          prompt_tokens: 20,
          completion_tokens: 3,
          total_tokens: 23,
          completion_tokens_details: { reasoning_tokens: 2 },
          cost: 0.002
        }
      )
    ];
    const intelligence = defineIntelligence(
      input(async (_url, init) => {
        payloads.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        authorization = new Headers(init?.headers).get("authorization");
        return response(replies.shift());
      })
    );

    const result = await intelligence.completeWithTools({
      system: "Ground every answer.",
      user: "When is launch?",
      firstTool: "retrieve",
      tools: [tool(async () => ({ hits: [{ hitId: "hit-1" }] }))]
    });

    assert.equal(authorization, "Bearer secret-for-tests");
    assert.deepEqual(payloads[0].tool_choice, {
      type: "function",
      function: { name: "retrieve" }
    });
    assert.equal(payloads[0].parallel_tool_calls, false);
    assert.equal(payloads[1].tool_choice, "auto");
    assert.deepEqual((payloads[1].messages as Record<string, unknown>[]).at(-1), {
      role: "tool",
      tool_call_id: "call-1",
      content: '{"ok":true,"value":{"hits":[{"hitId":"hit-1"}]}}'
    });
    assert.equal(result.text, "Grounded answer.");
    assert.equal(result.rounds, 2);
    assert.deepEqual(result.usage, {
      requestCount: 2,
      promptTokens: 30,
      completionTokens: 7,
      totalTokens: 37,
      reasoningTokens: 2,
      costUsd: 0.003
    });
    assert.deepEqual(result.toolCalls, [
      { id: "call-1", name: "retrieve", input: { query: "launch" }, ok: true }
    ]);
  });

  it("returns bad arguments to the model without executing the handler", async () => {
    let executed = false;
    const replies = [
      turn({
        content: null,
        tool_calls: [
          {
            id: "call-bad",
            type: "function",
            function: { name: "retrieve", arguments: "not-json" }
          }
        ]
      }),
      turn({ content: "Recovered.", tool_calls: [] })
    ];
    const payloads: Record<string, unknown>[] = [];
    const intelligence = defineIntelligence(
      input(async (_url, init) => {
        payloads.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        return response(replies.shift());
      })
    );

    const result = await intelligence.completeWithTools({
      system: "Use tools.",
      user: "Find it.",
      tools: [
        tool(async () => {
          executed = true;
          return {};
        })
      ]
    });

    assert.equal(executed, false);
    assert.equal(result.toolCalls[0].ok, false);
    assert.match(
      String((payloads[1].messages as Record<string, unknown>[]).at(-1)?.content),
      /valid JSON/
    );
  });

  it("stops after the configured number of tool rounds", async () => {
    let requests = 0;
    const intelligence = defineIntelligence(
      input(async () => {
        requests += 1;
        return response(
          turn({
            content: null,
            tool_calls: [
              {
                id: `call-${requests}`,
                type: "function",
                function: { name: "retrieve", arguments: '{"query":"again"}' }
              }
            ]
          })
        );
      }, 1)
    );

    await assert.rejects(
      () =>
        intelligence.completeWithTools({
          system: "Use tools.",
          user: "Loop.",
          tools: [tool(async () => ({}))]
        }),
      /tool-round limit/
    );
    assert.equal(requests, 2);
  });

  it("bounds provider failures without exposing a body or credential", async () => {
    const intelligence = defineIntelligence(
      input(async () => response({ error: { message: "secret-for-tests was rejected" } }, 401))
    );
    await assert.rejects(
      () =>
        intelligence.completeWithTools({
          system: "Use tools.",
          user: "Find it.",
          tools: [tool(async () => ({}))]
        }),
      (error: Error) => {
        assert.match(error.message, /status 401/);
        assert.doesNotMatch(error.message, /secret-for-tests/);
        return true;
      }
    );
  });

  it("aborts a provider request at the configured timeout", async () => {
    const intelligence = defineIntelligence({
      ...input(
        async (_url, init) =>
          await new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
          })
      ),
      timeoutMs: 5
    });

    await assert.rejects(
      () =>
        intelligence.completeWithTools({
          system: "Use tools.",
          user: "Find it.",
          tools: [tool(async () => ({}))]
        }),
      /timed out/
    );
  });

  it("validates the complete provision before startup", () => {
    const values: Record<string, unknown> = {
      "intelligence.api": "openrouter",
      "intelligence.providers.openrouter.apiKey": "key",
      "intelligence.providers.openrouter.endpoint": "https://openrouter.ai/api/v1/chat/completions",
      "intelligence.providers.openrouter.model": "~openai/gpt-latest",
      "intelligence.providers.openrouter.timeoutMs": 180_000,
      "intelligence.providers.openrouter.maxOutputTokens": 4096,
      "intelligence.providers.openrouter.reasoningEffort": "medium",
      "intelligence.agent.maxToolRounds": 8
    };
    const configuration = { get: (key: string) => values[key] };

    assert.equal(typeof createIntelligence(configuration).completeWithTools, "function");
    values["intelligence.providers.openrouter.reasoningEffort"] = "maximum";
    assert.throws(() => createIntelligence(configuration), /low.*medium.*high/);
  });
});

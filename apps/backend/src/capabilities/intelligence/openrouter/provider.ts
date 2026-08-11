import type {
  Provider,
  ProviderEmbedRequest,
  ProviderEmbedResponse,
  ProviderInferenceRequest,
  ProviderInferenceResponse,
  ProviderReasoningRequest,
  ProviderReasoningResponse
} from "#capabilities/intelligence/provider.js";
import type { ToolCall, ToolDefinition } from "#capabilities/intelligence/tools.js";
import type { Message, OpenRouterProviderConfig, Usage } from "#capabilities/intelligence/types.js";

const DEFAULT_REASONING_USAGE = 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseUsage = (value: unknown): Usage => {
  if (!isRecord(value)) {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      reasoningTokens: 0
    };
  }

  return {
    promptTokens:
      typeof value.prompt_tokens === "number" ? value.prompt_tokens : 0,
    completionTokens:
      typeof value.completion_tokens === "number" ? value.completion_tokens : 0,
    totalTokens: typeof value.total_tokens === "number" ? value.total_tokens : 0,
    reasoningTokens:
      typeof value.reasoning_tokens === "number"
        ? value.reasoning_tokens
        : DEFAULT_REASONING_USAGE,
    costUsd: typeof value.cost === "number" ? value.cost : undefined
  };
};

const parseContent = (value: unknown): string => {
  if (!isRecord(value)) {
    return "";
  }

  const content = value.content;
  return typeof content === "string" ? content : "";
};

const parseToolCalls = (value: unknown): ToolCall[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const calls: ToolCall[] = [];

  for (const rawCall of value) {
    if (!isRecord(rawCall)) {
      continue;
    }

    const callId = typeof rawCall.id === "string" ? rawCall.id : "";
    const fn = isRecord(rawCall.function) ? rawCall.function : undefined;
    const name = fn && typeof fn.name === "string" ? fn.name : "";
    const rawArgs = fn && typeof fn.arguments === "string" ? fn.arguments : "{}";

    if (!callId || !name) {
      continue;
    }

    let parsedArgs: Record<string, unknown> = {};
    try {
      const decoded = JSON.parse(rawArgs);
      if (isRecord(decoded)) {
        parsedArgs = decoded;
      }
    } catch {
      parsedArgs = {};
    }

    calls.push({
      id: callId,
      name,
      arguments: parsedArgs
    });
  }

  return calls;
};

const toWireMessages = (messages: Message[]): unknown[] =>
  messages.map((message) => {
    if (message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0) {
      return {
        role: message.role,
        content: message.content ?? "",
        tool_calls: message.toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: "function",
          function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.arguments)
          }
        }))
      };
    }

    if (message.role === "tool") {
      return {
        role: "tool",
        content: message.content ?? "",
        tool_call_id: message.toolCallId
      };
    }

    return {
      role: message.role,
      content: message.content ?? ""
    };
  });

const toWireTools = (tools: ToolDefinition[]): unknown[] =>
  tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));

const schemaFormat = (schema: Record<string, unknown>): Record<string, unknown> => ({
  type: "json_schema",
  json_schema: {
    name: "structured_response",
    strict: true,
    schema
  }
});

export class OpenRouterProvider implements Provider {
  constructor(private readonly config: OpenRouterProviderConfig) {}

  name(): string {
    return "openrouter";
  }

  async infer(
    signal: AbortSignal | undefined,
    req: ProviderInferenceRequest
  ): Promise<ProviderInferenceResponse> {
    const response = await this.chatCompletion(signal, {
      model: req.model,
      messages: toWireMessages(req.messages),
      ...(req.effort ? { reasoning: { effort: req.effort } } : {}),
      ...(req.schema ? { response_format: schemaFormat(req.schema) } : {})
    });

    return {
      content: response.content,
      usage: response.usage
    };
  }

  async reason(
    signal: AbortSignal | undefined,
    req: ProviderReasoningRequest
  ): Promise<ProviderReasoningResponse> {
    const response = await this.chatCompletion(signal, {
      model: req.model,
      messages: toWireMessages(req.messages),
      ...(req.effort ? { reasoning: { effort: req.effort } } : {}),
      ...(req.schema ? { response_format: schemaFormat(req.schema) } : {}),
      ...(req.tools && req.tools.length > 0 ? { tools: toWireTools(req.tools) } : {})
    });

    return {
      content: response.content,
      toolCalls: response.toolCalls,
      usage: response.usage
    };
  }

  async embed(
    signal: AbortSignal | undefined,
    req: ProviderEmbedRequest
  ): Promise<ProviderEmbedResponse> {
    const data = await this.postJson(
      "/embeddings",
      {
        model: req.model,
        input: req.inputs
      },
      signal
    );

    const vectors = isRecord(data) && Array.isArray(data.data)
      ? data.data
          .filter((item): item is Record<string, unknown> => isRecord(item))
          .map((item) => {
            const embedding = item.embedding;
            if (!Array.isArray(embedding)) {
              return [];
            }
            return embedding.filter((value): value is number => typeof value === "number");
          })
      : [];

    return {
      vectors,
      usage: parseUsage(isRecord(data) ? data.usage : undefined)
    };
  }

  private async chatCompletion(
    signal: AbortSignal | undefined,
    body: Record<string, unknown>
  ): Promise<{ content: string; toolCalls: ToolCall[]; usage: Usage }> {
    const data = await this.postJson("/chat/completions", body, signal);

    if (!isRecord(data) || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error("OpenRouter response did not contain choices");
    }

    const firstChoice = data.choices[0];
    if (!isRecord(firstChoice)) {
      throw new Error("OpenRouter response choice was invalid");
    }

    const message = isRecord(firstChoice.message) ? firstChoice.message : {};

    return {
      content: parseContent(message),
      toolCalls: parseToolCalls(message.tool_calls),
      usage: parseUsage(data.usage)
    };
  }

  private async postJson(
    path: string,
    body: Record<string, unknown>,
    signal: AbortSignal | undefined
  ): Promise<unknown> {
    if (!this.config.apiKey) {
      throw new Error("OpenRouter API key is missing");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    const linkedAbort = (): void => controller.abort();
    signal?.addEventListener("abort", linkedAbort);

    try {
      const response = await fetch(`${this.config.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        // Drain the response without carrying provider payloads into service
        // diagnostics or logs. Provider bodies may echo prompts, tool input,
        // account metadata, or other user-controlled content.
        await response.arrayBuffer();
        const requestId =
          response.headers.get("x-request-id") ??
          response.headers.get("x-openrouter-request-id");
        throw new Error(
          `OpenRouter request failed (${response.status})` +
            (requestId ? ` [requestId=${requestId}]` : "")
        );
      }

      return (await response.json()) as unknown;
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", linkedAbort);
    }
  }
}

import type {
  IntelligenceInput,
  IntelligenceResult,
  IntelligenceState,
  IntelligenceToolCall,
  IntelligenceUsage
} from "$model/server/intelligence/types";
import { IntelligenceServiceError } from "$model/server/intelligence/types";

type WireToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type WireMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls: WireToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type ProviderTurn = {
  content: string | null;
  toolCalls: WireToolCall[];
  usage: Omit<IntelligenceUsage, "requestCount">;
};

const record = (value: unknown, message: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new IntelligenceServiceError(message);
  }
  return value as Record<string, unknown>;
};

const finite = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;

const optionalFinite = (value: unknown): number | undefined => {
  const number = finite(value);
  return number === 0 && value !== 0 ? undefined : number;
};

const parseUsage = (value: unknown): ProviderTurn["usage"] => {
  const usage = value === undefined ? {} : record(value, "OpenRouter returned invalid usage");
  const details =
    usage.completion_tokens_details === undefined
      ? {}
      : record(usage.completion_tokens_details, "OpenRouter returned invalid token details");
  return {
    promptTokens: finite(usage.prompt_tokens),
    completionTokens: finite(usage.completion_tokens),
    totalTokens: finite(usage.total_tokens),
    ...(optionalFinite(details.reasoning_tokens) === undefined
      ? {}
      : { reasoningTokens: optionalFinite(details.reasoning_tokens) }),
    ...(optionalFinite(usage.cost) === undefined
      ? {}
      : { costUsd: optionalFinite(usage.cost) })
  };
};

const parseTurn = (value: unknown): ProviderTurn => {
  const root = record(value, "OpenRouter returned an invalid response");
  if (!Array.isArray(root.choices) || root.choices.length === 0) {
    throw new IntelligenceServiceError("OpenRouter returned no completion choice");
  }
  const choice = record(root.choices[0], "OpenRouter returned an invalid completion choice");
  const message = record(choice.message, "OpenRouter returned an invalid completion message");
  if (message.content !== null && message.content !== undefined && typeof message.content !== "string") {
    throw new IntelligenceServiceError("OpenRouter returned invalid completion content");
  }

  const rawCalls = message.tool_calls ?? [];
  if (!Array.isArray(rawCalls)) {
    throw new IntelligenceServiceError("OpenRouter returned invalid tool calls");
  }
  const ids = new Set<string>();
  const toolCalls = rawCalls.map((value): WireToolCall => {
    const call = record(value, "OpenRouter returned an invalid tool call");
    const fn = record(call.function, "OpenRouter returned an invalid function call");
    if (
      typeof call.id !== "string" ||
      !call.id ||
      typeof fn.name !== "string" ||
      !fn.name ||
      typeof fn.arguments !== "string"
    ) {
      throw new IntelligenceServiceError("OpenRouter returned an incomplete tool call");
    }
    if (ids.has(call.id)) {
      throw new IntelligenceServiceError("OpenRouter returned duplicate tool call identifiers");
    }
    ids.add(call.id);
    return {
      id: call.id,
      type: "function",
      function: { name: fn.name, arguments: fn.arguments }
    };
  });

  return {
    content: typeof message.content === "string" ? message.content : null,
    toolCalls,
    usage: parseUsage(root.usage)
  };
};

const safeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : "Tool execution failed";
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[-_ ]?key)\s*[:=]\s*\S+/gi, "apiKey=[redacted]")
    .slice(0, 400);
};

const serialize = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? null);
  } catch (error) {
    throw new IntelligenceServiceError("A tool returned a value that cannot be serialized", {
      cause: error
    });
  }
};

const addUsage = (
  total: IntelligenceUsage,
  next: ProviderTurn["usage"]
): IntelligenceUsage => ({
  requestCount: total.requestCount + 1,
  promptTokens: total.promptTokens + next.promptTokens,
  completionTokens: total.completionTokens + next.completionTokens,
  totalTokens: total.totalTokens + next.totalTokens,
  ...((total.reasoningTokens !== undefined || next.reasoningTokens !== undefined)
    ? { reasoningTokens: (total.reasoningTokens ?? 0) + (next.reasoningTokens ?? 0) }
    : {}),
  ...((total.costUsd !== undefined || next.costUsd !== undefined)
    ? { costUsd: (total.costUsd ?? 0) + (next.costUsd ?? 0) }
    : {})
});

const invoke = async (
  state: IntelligenceState,
  messages: readonly WireMessage[],
  input: IntelligenceInput<unknown>,
  firstTool: string | undefined
): Promise<ProviderTurn> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), state.timeoutMs);
  try {
    const response = await state.request(state.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${state.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: state.model,
        messages,
        tools: input.tools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
          }
        })),
        tool_choice:
          firstTool === undefined
            ? "auto"
            : { type: "function", function: { name: firstTool } },
        parallel_tool_calls: false,
        max_tokens: state.maxOutputTokens,
        reasoning: { effort: state.reasoningEffort },
        ...(input.output === undefined
          ? {}
          : {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: input.output.name,
                  ...(input.output.description === undefined
                    ? {}
                    : { description: input.output.description }),
                  strict: true,
                  schema: input.output.schema
                }
              }
            })
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new IntelligenceServiceError(`OpenRouter request failed with status ${response.status}`);
    }
    return parseTurn(await response.json());
  } catch (error) {
    if (error instanceof IntelligenceServiceError) throw error;
    if (controller.signal.aborted) {
      throw new IntelligenceServiceError("OpenRouter request timed out", { cause: error });
    }
    throw new IntelligenceServiceError("OpenRouter request failed", { cause: error });
  } finally {
    clearTimeout(timeout);
  }
};

const parsedInput = (call: WireToolCall): { ok: true; value: unknown } | { ok: false; error: string } => {
  try {
    return { ok: true, value: JSON.parse(call.function.arguments) as unknown };
  } catch {
    return { ok: false, error: "Tool arguments must be valid JSON" };
  }
};

/** OpenAI-compatible tool loop: propose, execute locally, return result, repeat. */
export const runAgent = async <Value = string>(
  state: IntelligenceState,
  input: IntelligenceInput<Value>
): Promise<IntelligenceResult<Value>> => {
  if (!input.system.trim() || !input.user.trim()) {
    throw new IntelligenceServiceError("Intelligence prompts must not be blank");
  }
  const tools = new Map(input.tools.map((tool) => [tool.name, tool]));
  if (tools.size !== input.tools.length || [...tools.keys()].some((name) => !name)) {
    throw new IntelligenceServiceError("Intelligence tool names must be unique and non-blank");
  }
  if (input.firstTool !== undefined && !tools.has(input.firstTool)) {
    throw new IntelligenceServiceError("The forced first tool is not available");
  }
  if (input.output !== undefined && !input.output.name.trim()) {
    throw new IntelligenceServiceError("Structured output names must not be blank");
  }

  const messages: WireMessage[] = [
    { role: "system", content: input.system },
    { role: "user", content: input.user }
  ];
  const calls: IntelligenceToolCall[] = [];
  let usage: IntelligenceUsage = {
    requestCount: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0
  };

  for (let round = 1; round <= state.maxToolRounds + 1; round += 1) {
    const turn = await invoke(
      state,
      messages,
      input,
      round === 1 ? input.firstTool : undefined
    );
    usage = addUsage(usage, turn.usage);

    if (turn.toolCalls.length === 0) {
      const text = turn.content?.trim();
      if (!text) throw new IntelligenceServiceError("OpenRouter returned no final text");
      if (input.output === undefined) {
        return { value: text as Value, usage, toolCalls: calls, rounds: round };
      }
      try {
        return {
          value: input.output.parse(JSON.parse(text) as unknown),
          usage,
          toolCalls: calls,
          rounds: round
        };
      } catch (error) {
        throw new IntelligenceServiceError("OpenRouter returned invalid structured output", {
          cause: error
        });
      }
    }
    if (round > state.maxToolRounds) {
      throw new IntelligenceServiceError("Agent exceeded the configured tool-round limit");
    }

    messages.push({ role: "assistant", content: turn.content, tool_calls: turn.toolCalls });
    for (const call of turn.toolCalls) {
      const parsed = parsedInput(call);
      const tool = tools.get(call.function.name);
      let output: unknown;
      let ok = false;
      if (!parsed.ok) {
        output = { ok: false, error: parsed.error };
      } else if (tool === undefined) {
        output = { ok: false, error: `Unknown tool '${call.function.name}'` };
      } else {
        try {
          output = { ok: true, value: await tool.execute(parsed.value) };
          ok = true;
        } catch (error) {
          output = { ok: false, error: safeError(error) };
        }
      }
      calls.push({
        id: call.id,
        name: call.function.name,
        input: parsed.ok ? parsed.value : call.function.arguments,
        ok
      });
      messages.push({ role: "tool", tool_call_id: call.id, content: serialize(output) });
    }
  }

  throw new IntelligenceServiceError("Agent exceeded the configured tool-round limit");
};

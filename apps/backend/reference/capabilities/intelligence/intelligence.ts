import type {
  Cast,
  CastRoute,
  EmbedRequest,
  EmbedResult,
  InferRequest,
  IntelligenceConfig,
  Message,
  ReasonRequest,
  StructuredResult,
  TextResult,
  Usage
} from "#capabilities/intelligence/types.js";
import type { Provider } from "#capabilities/intelligence/provider.js";
import type { ToolCall, ToolResult, ToolSet } from "#capabilities/intelligence/tools.js";
import type { Logger } from "#capabilities/observability/logger.js";

const DEFAULT_PURPOSE = "general";
const DEFAULT_MAX_TOOL_ROUNDS = 8;

const TIER_VALUES = new Set(["low", "medium", "high"]);

const usageZero = (): Usage => ({
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  reasoningTokens: 0
});

const addUsage = (left: Usage, right: Usage): Usage => ({
  promptTokens: left.promptTokens + right.promptTokens,
  completionTokens: left.completionTokens + right.completionTokens,
  totalTokens: left.totalTokens + right.totalTokens,
  reasoningTokens: left.reasoningTokens + right.reasoningTokens,
  costUsd:
    left.costUsd !== undefined || right.costUsd !== undefined
      ? (left.costUsd ?? 0) + (right.costUsd ?? 0)
      : undefined
});

const now = (): number => performance.now();

interface IntelligenceTelemetry {
  op: string;
  provider: string;
  model: string;
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  costUsd?: number;
  [key: string]: unknown;
}

const telemetry = (
  op: string,
  provider: string,
  model: string,
  startMs: number,
  usage: Usage,
  extra?: Record<string, unknown>
): IntelligenceTelemetry => ({
  op,
  provider,
  model,
  durationMs: Math.round(performance.now() - startMs),
  promptTokens: usage.promptTokens,
  completionTokens: usage.completionTokens,
  reasoningTokens: usage.reasoningTokens,
  totalTokens: usage.totalTokens,
  ...(usage.costUsd !== undefined ? { costUsd: usage.costUsd } : {}),
  ...extra
});

const normalizeCast = (cast: Cast): Cast => ({
  purpose: cast.purpose.trim().toLowerCase() || DEFAULT_PURPOSE,
  strength: cast.strength,
  speed: cast.speed
});

const normalizeRouteCast = (route: CastRoute): Cast => ({
  purpose: route.purpose.trim().toLowerCase() || DEFAULT_PURPOSE,
  strength: route.strength,
  speed: route.speed
});

const castKey = (cast: Cast): string =>
  `${cast.purpose}|${cast.strength}|${cast.speed}`;

const ensureTier = (value: string, field: string): void => {
  if (!TIER_VALUES.has(value)) {
    throw new Error(`Invalid intelligence ${field} tier: '${value}'`);
  }
};

const extractStructured = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Structured response was not valid JSON");
  }
};

const cloneMessages = (messages: Message[]): Message[] =>
  messages.map((message) => ({
    ...message,
    toolCalls: message.toolCalls?.map((toolCall) => ({
      ...toolCall,
      arguments: { ...toolCall.arguments }
    }))
  }));

export class Intelligence {
  private readonly inferenceRoutes = new Map<string, CastRoute>();
  private readonly reasoningRoutes = new Map<string, CastRoute>();

  constructor(
    private readonly config: IntelligenceConfig,
    private readonly providers: Record<string, Provider>,
    private readonly logger: Logger
  ) {
    this.inferenceRoutes = this.createRouteMap(config.inference.routes, "inference");
    this.reasoningRoutes = this.createRouteMap(config.reasoning.routes, "reasoning");
  }

  async infer(signal: AbortSignal | undefined, req: InferRequest): Promise<TextResult> {
    const t = now();
    const route = this.resolveRoute("inference", req.cast);
    const provider = this.getProvider(route.provider);
    const response = await provider.infer(signal, {
      model: route.model,
      messages: cloneMessages(req.messages),
      effort: route.effort
    });

    this.logger.debug("intelligence", telemetry("infer", route.provider, route.model, t, response.usage));
    return {
      text: response.content,
      usage: response.usage
    };
  }

  async inferStructured(
    signal: AbortSignal | undefined,
    req: InferRequest,
    schema: Record<string, unknown>
  ): Promise<StructuredResult> {
    const t = now();
    const route = this.resolveRoute("inference", req.cast);
    const provider = this.getProvider(route.provider);
    const response = await provider.infer(signal, {
      model: route.model,
      messages: cloneMessages(req.messages),
      effort: route.effort,
      schema
    });

    this.logger.debug("intelligence", telemetry("inferStructured", route.provider, route.model, t, response.usage));
    return {
      structured: extractStructured(response.content),
      usage: response.usage
    };
  }

  async reason(signal: AbortSignal | undefined, req: ReasonRequest): Promise<TextResult> {
    const t = now();
    const route = this.resolveRoute("reasoning", req.cast);
    const provider = this.getProvider(route.provider);
    const response = await provider.reason(signal, {
      model: route.model,
      messages: cloneMessages(req.messages),
      effort: route.effort
    });

    if (response.toolCalls.length > 0) {
      throw new Error("Reason call returned tool calls; use reasonWithTools instead");
    }

    this.logger.debug("intelligence", telemetry("reason", route.provider, route.model, t, response.usage));
    return {
      text: response.content,
      usage: response.usage
    };
  }

  async reasonStructured(
    signal: AbortSignal | undefined,
    req: ReasonRequest,
    schema: Record<string, unknown>
  ): Promise<StructuredResult> {
    const t = now();
    const route = this.resolveRoute("reasoning", req.cast);
    const provider = this.getProvider(route.provider);
    const response = await provider.reason(signal, {
      model: route.model,
      messages: cloneMessages(req.messages),
      effort: route.effort,
      schema
    });

    if (response.toolCalls.length > 0) {
      throw new Error("Reason call returned tool calls; use reasonWithToolsStructured instead");
    }

    this.logger.debug("intelligence", telemetry("reasonStructured", route.provider, route.model, t, response.usage));
    return {
      structured: extractStructured(response.content),
      usage: response.usage
    };
  }

  async reasonWithTools(
    signal: AbortSignal | undefined,
    req: ReasonRequest,
    tools: ToolSet,
    maxRounds = DEFAULT_MAX_TOOL_ROUNDS
  ): Promise<{
    text: string;
    messages: Message[];
    toolResults: ToolResult[];
    rounds: number;
    calls: number;
    usage: Usage;
  }> {
    return this.reasonWithToolsInternal(signal, req, tools, undefined, maxRounds);
  }

  async reasonWithToolsStructured(
    signal: AbortSignal | undefined,
    req: ReasonRequest,
    tools: ToolSet,
    schema: Record<string, unknown>,
    maxRounds = DEFAULT_MAX_TOOL_ROUNDS
  ): Promise<{
    structured: unknown;
    messages: Message[];
    toolResults: ToolResult[];
    rounds: number;
    calls: number;
    usage: Usage;
  }> {
    const response = await this.reasonWithToolsInternal(signal, req, tools, schema, maxRounds);

    return {
      structured: extractStructured(response.text),
      messages: response.messages,
      toolResults: response.toolResults,
      rounds: response.rounds,
      calls: response.calls,
      usage: response.usage
    };
  }

  async embed(signal: AbortSignal | undefined, req: EmbedRequest): Promise<EmbedResult> {
    const t = now();
    const provider = this.getProvider(this.config.embedding.provider);
    const response = await provider.embed(signal, {
      model: this.config.embedding.model,
      inputs: [...req.inputs]
    });

    this.logger.debug("intelligence", telemetry("embed", this.config.embedding.provider, this.config.embedding.model, t, response.usage, { inputCount: req.inputs.length }));
    return {
      vectors: response.vectors,
      provider: this.config.embedding.provider,
      model: this.config.embedding.model,
      usage: response.usage
    };
  }

  private async reasonWithToolsInternal(
    signal: AbortSignal | undefined,
    req: ReasonRequest,
    tools: ToolSet,
    schema: Record<string, unknown> | undefined,
    maxRounds: number
  ): Promise<{
    text: string;
    messages: Message[];
    toolResults: ToolResult[];
    rounds: number;
    calls: number;
    usage: Usage;
  }> {
    const t = now();
    const route = this.resolveRoute("reasoning", req.cast);
    const provider = this.getProvider(route.provider);
    const messages = cloneMessages(req.messages);
    const toolResults: ToolResult[] = [];
    let usage = usageZero();
    let rounds = 0;
    let calls = 0;

    while (rounds < maxRounds) {
      const response = await provider.reason(signal, {
        model: route.model,
        messages: cloneMessages(messages),
        effort: route.effort,
        schema,
        tools: tools.definitions()
      });

      usage = addUsage(usage, response.usage);

      if (response.toolCalls.length === 0) {
        messages.push({ role: "assistant", content: response.content });
        this.logger.debug("intelligence", telemetry("reasonWithTools", route.provider, route.model, t, usage, { rounds, toolCalls: calls }));
        return {
          text: response.content,
          messages,
          toolResults,
          rounds,
          calls,
          usage
        };
      }

      rounds += 1;
      calls += response.toolCalls.length;

      messages.push({
        role: "assistant",
        content: response.content,
        toolCalls: response.toolCalls.map((toolCall) => ({
          id: toolCall.id,
          name: toolCall.name,
          arguments: { ...toolCall.arguments }
        }))
      });

      for (const call of response.toolCalls) {
        const toolResult = await tools.execute(call);
        toolResults.push(toolResult);

        messages.push({
          role: "tool",
          toolCallId: call.id,
          content: JSON.stringify({
            ok: toolResult.ok,
            ...(toolResult.ok ? { output: toolResult.output } : { error: toolResult.error })
          })
        });
      }
    }

    throw new Error(`Reasoning tool loop exceeded max rounds (${maxRounds})`);
  }

  private resolveRoute(kind: "inference" | "reasoning", cast: Cast): CastRoute {
    const normalized = normalizeCast(cast);

    ensureTier(normalized.strength, "strength");
    ensureTier(normalized.speed, "speed");

    const key = castKey(normalized);
    const map = kind === "inference" ? this.inferenceRoutes : this.reasoningRoutes;
    const route = map.get(key);

    if (!route) {
      throw new Error(`No configured ${kind} cast route for '${key}'`);
    }

    return route;
  }

  private createRouteMap(routes: CastRoute[], kind: "inference" | "reasoning"): Map<string, CastRoute> {
    const routeMap = new Map<string, CastRoute>();

    for (const route of routes) {
      const normalized = normalizeRouteCast(route);
      ensureTier(normalized.strength, "strength");
      ensureTier(normalized.speed, "speed");

      const key = castKey(normalized);

      if (routeMap.has(key)) {
        throw new Error(`Duplicate ${kind} cast route: '${key}'`);
      }

      routeMap.set(key, {
        ...route,
        purpose: normalized.purpose,
        strength: normalized.strength,
        speed: normalized.speed
      });
    }

    return routeMap;
  }

  private getProvider(name: string): Provider {
    const provider = this.providers[name];
    if (!provider) {
      throw new Error(`Intelligence provider '${name}' is not configured`);
    }

    return provider;
  }
}

# Platform — Icarus Intelligence Interface & Provider Adapters

> Mirrored from [Notion](https://app.notion.com/p/3aeb6410e5028167a108e39258526aa9).

## Summary / Concept
> **Build position — Foundations 1.** Intelligence establishes the provider-neutral model interface consumed by later foundation and capability work.
### Prerequisites
- Validated Intelligence routing and provider configuration.
- Platform Logger and provider adapters.
- Runtime composition under `1-init/create/intelligence.ts`.
### Concept and authority
Intelligence is a shared Platform interface. It is constructed once from configuration and Logger, then injected into capability application services. Provider choice remains behind the interface; capability code supplies a Cast and typed request.
Capabilities describe the semantic work they need. Intelligence resolves that request to a configured provider, model, and provider-specific effort level.
The public selection model has three fields:
```typescript
export type IntelligenceTier = "low" | "medium" | "high";

export interface Cast {
  purpose: string;
  strength: IntelligenceTier;
  speed: IntelligenceTier;
}
```
- `purpose` identifies the kind of work and supplies the main routing namespace.
- `strength` expresses the requested capability level.
- `speed` expresses the requested latency preference.
Cast routing uses exactly these three axes. When a workflow needs an economy or premium route, that distinction belongs in the purpose label:
```typescript
const economyDiscovery: Cast = {
  purpose: "research.discovery.economy",
  strength: "medium",
  speed: "high"
};

const premiumSynthesis: Cast = {
  purpose: "research.synthesis.premium",
  strength: "high",
  speed: "medium"
};
```
This keeps the request internally coherent. Purpose labels can encode product policy while strength and speed retain their direct meaning.
### Repository placement and construction
```plain text
apps/backend/src/
  0-platform/
    intelligence/
      intelligence.ts
      provider.ts
      tools.ts
      types.ts
      openrouter/
        provider.ts
  0-utils/
    config/
      loadBackendConfig.ts
  1-init/
    create/
      intelligence.ts
    startBackend.ts

apps/backend/etc/
  configuration.yaml
```
`createIntelligence` constructs provider adapters and one shared `Intelligence` object. Consuming capabilities receive that object, or a narrower capability-owned port backed by it, through dependency injection.
### Configuration
Routes are explicit:
```yaml
intelligence:
  providers:
    openrouter:
      apiKey: replace-with-openrouter-api-key
      baseUrl: https://openrouter.ai/api/v1
      timeoutMs: 30000

  inference:
    routes:
      - purpose: research.extract
        strength: medium
        speed: high
        provider: openrouter
        model: openai/gpt-4.1-mini
        effort: low

  reasoning:
    routes:
      - purpose: research.synthesis.premium
        strength: high
        speed: medium
        provider: openrouter
        model: openai/gpt-4.1
        effort: medium

  embedding:
    provider: openrouter
    model: openai/text-embedding-3-large
```
The committed baseline supplies the full nine strength/speed combinations for the `general` inference and reasoning purposes. Additional purpose families are additive configuration.
## Types & Interfaces
### Core types
```typescript
export interface CastRoute {
  purpose: string;
  strength: IntelligenceTier;
  speed: IntelligenceTier;
  provider: string;
  model: string;
  effort?: IntelligenceTier;
}

export interface IntelligenceConfig {
  providers: {
    openrouter: OpenRouterProviderConfig;
  };
  inference: {
    routes: CastRoute[];
  };
  reasoning: {
    routes: CastRoute[];
  };
  embedding: {
    provider: string;
    model: string;
  };
}

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: MessageRole;
  content?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  toolCallId?: string;
}

export interface InferRequest {
  cast: Cast;
  messages: Message[];
}

export interface ReasonRequest {
  cast: Cast;
  messages: Message[];
}

export interface EmbedRequest {
  inputs: string[];
}
```
Usage is normalized across providers:
```typescript
export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens: number;
}

export interface TextResult {
  text: string;
  usage: Usage;
}

export interface StructuredResult {
  structured: unknown;
  usage: Usage;
}

export interface EmbedResult {
  vectors: number[][];
  provider: string;
  model: string;
  usage: Usage;
}
```
### Public runtime surface
The implemented `Intelligence` class provides:
```typescript
class Intelligence {
  infer(
    signal: AbortSignal | undefined,
    req: InferRequest
  ): Promise<TextResult>;

  inferStructured(
    signal: AbortSignal | undefined,
    req: InferRequest,
    schema: Record<string, unknown>
  ): Promise<StructuredResult>;

  reason(
    signal: AbortSignal | undefined,
    req: ReasonRequest
  ): Promise<TextResult>;

  reasonStructured(
    signal: AbortSignal | undefined,
    req: ReasonRequest,
    schema: Record<string, unknown>
  ): Promise<StructuredResult>;

  reasonWithTools(
    signal: AbortSignal | undefined,
    req: ReasonRequest,
    tools: ToolSet,
    maxRounds?: number
  ): Promise<ToolReasoningResult>;

  reasonWithToolsStructured(
    signal: AbortSignal | undefined,
    req: ReasonRequest,
    tools: ToolSet,
    schema: Record<string, unknown>,
    maxRounds?: number
  ): Promise<StructuredToolReasoningResult>;

  embed(
    signal: AbortSignal | undefined,
    req: EmbedRequest
  ): Promise<EmbedResult>;
}
```
Capability endpoints remain owned by the consuming capability. For example, Research may expose a request type that plans a research run; its service can call `reasonStructured` with a Research-owned schema and purpose label.
### Provider contract
Provider adapters receive resolved model-level requests:
```typescript
export interface Provider {
  name(): string;

  infer(
    signal: AbortSignal | undefined,
    req: ProviderInferenceRequest
  ): Promise<ProviderInferenceResponse>;

  reason(
    signal: AbortSignal | undefined,
    req: ProviderReasoningRequest
  ): Promise<ProviderReasoningResponse>;

  embed(
    signal: AbortSignal | undefined,
    req: ProviderEmbedRequest
  ): Promise<ProviderEmbedResponse>;
}
```
The platform currently supplies `OpenRouterProvider`. It translates Icarus messages, schemas, tools, reasoning effort, and embeddings to OpenRouter requests and normalizes content, tool calls, vectors, and usage.
An `AbortSignal` and provider timeout bound every network request. Embedding responses record the resolved provider and model with the vectors.
## Runtime Objects
### Route resolution
Inference and reasoning maintain separate route maps. A route key is:
```plain text
purpose | strength | speed
```
Resolution applies these rules:
1. trim and lowercase `purpose`;
2. use `general` when the normalized purpose is empty;
3. validate `strength` and `speed` as `low`, `medium`, or `high`;
4. select the route from the cast-kind-specific map;
5. resolve the named provider;
6. invoke the provider with the route’s model and optional effort.
Duplicate keys fail construction. Missing keys fail before a provider request.
```typescript
const castKey = (cast: Cast): string =>
  `${cast.purpose}|${cast.strength}|${cast.speed}`;
```
Purpose labels are configuration contracts. A capability should define its labels alongside its semantic input/output contract, while configuration decides which provider and model fulfill each label.
### Structured output
Structured calls accept a JSON Schema owned by the consuming capability:
```typescript
const answerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "evidenceIds"],
  properties: {
    answer: { type: "string" },
    evidenceIds: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;
```
The OpenRouter adapter sends it as a strict `json_schema` response format. Intelligence parses the returned text as JSON and returns the decoded value with normalized usage. The capability then validates semantic rules such as referenced IDs, allowed operations, revision pins, and evidence requirements before accepting the proposal.
### Tool-using reasoning
Tools have provider-facing definitions and local handlers:
```typescript
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolBinding {
  definition: ToolDefinition;
  handler: (
    args: Record<string, unknown>
  ) => Promise<unknown>;
}

export interface ToolResult {
  callId: string;
  name: string;
  ok: boolean;
  output?: unknown;
  error?: {
    code: string;
    message: string;
  };
}
```
`ToolSet` enforces unique tool names and executes calls by name. A reasoning loop:
1. sends the current message transcript and tool definitions;
2. receives zero or more tool calls;
3. executes each call locally;
4. appends structured tool results to the transcript;
5. repeats until the provider returns a final response;
6. aggregates usage across every provider round.
The default maximum is eight tool rounds. Callers can supply a tighter limit.
The result preserves:
- final text or structured output;
- the complete message transcript;
- every local tool result;
- tool rounds;
- total tool-call count;
- aggregated usage.
Tool handlers are capability adapters. A handler reads or commands a capability through its public port, preserving that capability’s validation and revision rules.
### Embeddings
Embedding routing is intentionally direct:
```typescript
const result = await intelligence.embed(signal, {
  inputs: [
    "first bounded text window",
    "second bounded text window"
  ]
});
```
The result contains vectors, provider, model, and usage. Knowledge and Media can therefore pin the embedding identity alongside their rebuildable projection generations.
### Capability integration
Capabilities define narrow semantic ports over the shared runtime:
```typescript
export interface ResearchReasoner {
  proposePlan(
    signal: AbortSignal,
    input: ResearchPlanningInput
  ): Promise<ResearchPlanProposal>;
}

export const createResearchReasoner = (
  intelligence: Intelligence
): ResearchReasoner => ({
  async proposePlan(signal, input) {
    const response = await intelligence.reasonStructured(
      signal,
      {
        cast: {
          purpose: "research.plan",
          strength: "high",
          speed: "medium"
        },
        messages: buildPlanningMessages(input)
      },
      researchPlanSchema
    );

    return validateResearchPlanProposal(response.structured);
  }
});
```
This adapter keeps prompting, schema, and domain validation close to Research while provider/model selection remains centralized.
### Operational errors
The runtime distinguishes failures by the boundary that reports them:
- cast validation and missing-route failures;
- provider configuration failures;
- provider HTTP/status failures;
- malformed provider responses;
- invalid structured JSON;
- reasoning tool-loop exhaustion;
- tool lookup and execution failures;
- caller cancellation and provider timeout.
Consuming Jobs translate these failures into capability-specific diagnostics and response envelopes. Provider payloads and credentials stay inside the Platform adapter.
## Change Operations
Intelligence owns no mutable capability Base and emits no ChangeSet. Its bounded runtime operations are `infer`, `inferStructured`, `reason`, `reasonStructured`, `reasonWithTools`, `reasonWithToolsStructured`, and `embed`. Each returns a normalized result or typed failure to the consuming capability.
## Endpoints
Intelligence is an in-process Platform interface. Product endpoints remain owned by the consuming capability, which supplies its Cast, messages, schemas, tools, domain validation, and response contract.
## Jobs
<table fit-page-width="true" header-row="true">
<tr>
<td>Endpoint or intent</td>
<td>Job</td>
<td>Queue</td>
<td>Response</td>
<td>Calls or emits</td>
</tr>
<tr>
<td>Capability query or command</td>
<td>Owned by the consuming capability</td>
<td>Selected by that capability</td>
<td>Inline or deferred</td>
<td>Calls one or more Intelligence operations; emits no Intelligence ChangeSet</td>
</tr>
<tr>
<td>Capability internal stage</td>
<td>Owned by the consuming capability</td>
<td>Concurrent or serial according to its publication boundary</td>
<td>Internal</td>
<td>Validates Intelligence output before changing capability state</td>
</tr>
</table>
## SQL Tables
Intelligence owns no SQL tables. Routes and provider credentials come from runtime configuration. Any durable result belongs to the consuming capability.
## Invariants
- A cast is exactly `purpose + strength + speed`.
- Route selection is deterministic for one normalized cast and configuration.
- Inference and reasoning routes are independent.
- Purpose labels carry workflow and policy meaning.
- Provider/model/effort are configuration results.
- Capability-owned schemas and validation govern structured proposals.
- Tool calls pass through typed local handlers.
- Tool reasoning is bounded by rounds and cancellation.
- Usage is accumulated across all provider rounds.
- Embedding results identify their provider and model.
- API keys remain in runtime configuration.
## Acceptance Criteria
- All nine `general` strength/speed combinations resolve for inference and reasoning.
- Purpose normalization is case-insensitive and whitespace-trimmed.
- Duplicate route keys fail startup.
- Missing routes fail before provider invocation.
- Plain and structured inference return normalized usage.
- Plain and structured reasoning return normalized usage.
- Tool reasoning executes registered tools, records their results, and stops at the round limit.
- Structured responses parse as JSON and remain subject to capability validation.
- Embedding results contain vectors, provider, model, and usage.
- Abort signals and provider timeouts cancel network work.
- The full backend constructs one Intelligence runtime from configuration.
## Source Files
- [`intelligence.ts`](https://github.com/gccurtis/icarus/blob/main/apps/backend/src/0-platform/intelligence/intelligence.ts)
- [`types.ts`](https://github.com/gccurtis/icarus/blob/main/apps/backend/src/0-platform/intelligence/types.ts)
- [`provider.ts`](https://github.com/gccurtis/icarus/blob/main/apps/backend/src/0-platform/intelligence/provider.ts)
- [`tools.ts`](https://github.com/gccurtis/icarus/blob/main/apps/backend/src/0-platform/intelligence/tools.ts)
- [`openrouter/provider.ts`](https://github.com/gccurtis/icarus/blob/main/apps/backend/src/0-platform/intelligence/openrouter/provider.ts)
- [`configuration.yaml`](https://github.com/gccurtis/icarus/blob/main/apps/backend/etc/configuration.yaml)

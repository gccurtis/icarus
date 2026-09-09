export type JsonSchema = Readonly<Record<string, unknown>>;

export type IntelligenceImage =
  | { readonly kind: "url"; readonly url: string }
  | { readonly kind: "bytes"; readonly base64: string; readonly mediaType: string };

export type IntelligenceUserInput =
  | string
  | { readonly text: string; readonly images: readonly IntelligenceImage[] };

export type IntelligenceToolOutput = {
  readonly kind: "intelligenceToolOutput";
  readonly value: unknown;
  readonly images: readonly IntelligenceImage[];
};

export const intelligenceToolOutput = (
  value: unknown,
  images: readonly IntelligenceImage[] = []
): IntelligenceToolOutput => ({ kind: "intelligenceToolOutput", value, images });

/** A function the model may ask the application to execute. */
export type IntelligenceTool = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  execute(input: unknown): Promise<unknown>;
};

/** A provider-enforced JSON shape plus the application parser that makes it trusted. */
export type IntelligenceStructuredOutput<Value> = {
  readonly name: string;
  readonly description?: string;
  readonly schema: JsonSchema;
  parse(value: unknown): Value;
};

export type IntelligenceInput<Value = string> = {
  readonly system: string;
  readonly user: IntelligenceUserInput;
  readonly tools: readonly IntelligenceTool[];
  /** Forces one named tool on the first provider turn; later turns remain automatic. */
  readonly firstTool?: string;
  /**
   * The tool that ends the run.
   *
   * An agent that delivers its answer by calling a tool has nothing left to say
   * afterwards, and asking it for a closing message costs a request and invites
   * an empty one. Calling this tool successfully returns from the loop.
   */
  readonly finalTool?: string;
  /**
   * A round bound for this call only, or -1 for none.
   *
   * The configured bound is one number for every caller, and callers do not all
   * do the same work: a single grounded synthesis is not a conversation. Absent
   * means the configured one.
   */
  readonly maxToolRounds?: number;
  readonly output?: IntelligenceStructuredOutput<Value>;
  /**
   * A model for this call only, when the caller's work is worth a different one.
   *
   * A name, never a provider: the endpoint, the credential and the bounds stay
   * the port's. Absent means the configured model.
   */
  readonly model?: string;
  /**
   * Abandons the run, including the provider request in flight.
   *
   * The port's own timeout still applies; this is the caller's reason on top of
   * it. A cancelled run rejects rather than answering, because a half-run has
   * nothing to say.
   */
  readonly signal?: AbortSignal;
};

export type IntelligenceUsage = {
  readonly requestCount: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly reasoningTokens?: number;
  readonly costUsd?: number;
};

export type IntelligenceToolCall = {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
  readonly ok: boolean;
};

export type IntelligenceResult<Value = string> = {
  readonly value: Value;
  readonly usage: IntelligenceUsage;
  readonly toolCalls: readonly IntelligenceToolCall[];
  readonly rounds: number;
};

/** The process-wide text intelligence port. Credentials never cross this boundary. */
export interface IntelligenceModel {
  completeWithTools<Value = string>(
    input: IntelligenceInput<Value>
  ): Promise<IntelligenceResult<Value>>;
}

export type IntelligenceRequest = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export type IntelligenceConfiguration = {
  readonly apiKey: string;
  readonly endpoint: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly maxOutputTokens: number;
  readonly reasoningEffort: "low" | "medium" | "high";
  readonly maxToolRounds: number;
  readonly request?: IntelligenceRequest;
};

export type IntelligenceState = Required<IntelligenceConfiguration>;

export class IntelligenceServiceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "IntelligenceServiceError";
  }
}

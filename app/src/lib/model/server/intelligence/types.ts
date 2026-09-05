export type JsonSchema = Readonly<Record<string, unknown>>;

/** A function the model may ask the application to execute. */
export type IntelligenceTool = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  execute(input: unknown): Promise<unknown>;
};

export type IntelligenceInput = {
  readonly system: string;
  readonly user: string;
  readonly tools: readonly IntelligenceTool[];
  /** Forces one named tool on the first provider turn; later turns remain automatic. */
  readonly firstTool?: string;
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

export type IntelligenceResult = {
  readonly text: string;
  readonly usage: IntelligenceUsage;
  readonly toolCalls: readonly IntelligenceToolCall[];
  readonly rounds: number;
};

/** The process-wide text intelligence port. Credentials never cross this boundary. */
export interface IntelligenceModel {
  completeWithTools(input: IntelligenceInput): Promise<IntelligenceResult>;
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

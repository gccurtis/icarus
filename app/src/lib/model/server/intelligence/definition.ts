import { completeWithTools } from "$model/server/intelligence/methods/run-agent/run-agent";
import type {
  IntelligenceConfiguration,
  IntelligenceInput,
  IntelligenceModel,
  IntelligenceResult,
  IntelligenceState
} from "$model/server/intelligence/types";

/** One immutable OpenRouter provision and its injected transport. */
export class OpenRouterIntelligence implements IntelligenceModel {
  readonly #state: IntelligenceState;

  constructor(input: IntelligenceConfiguration) {
    this.#state = { ...input, request: input.request ?? globalThis.fetch };
  }

  completeWithTools<Value = string>(
    input: IntelligenceInput<Value>
  ): Promise<IntelligenceResult<Value>> {
    return completeWithTools(this.#state, input);
  }
}

export const defineIntelligence = (
  input: IntelligenceConfiguration
): IntelligenceModel => new OpenRouterIntelligence(input);

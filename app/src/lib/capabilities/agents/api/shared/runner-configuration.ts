import type { ServerModel } from "$runtime/server/start.server";

const integer = (
  model: ServerModel,
  key: string,
  bounds: { readonly min: number; readonly max: number },
  allowUnbounded = false
): number => {
  const value = model.configuration.get(key);
  if (
    !Number.isSafeInteger(value) ||
    ((!allowUnbounded || value !== -1) && ((value as number) < bounds.min || (value as number) > bounds.max))
  ) {
    throw new Error(
      `Configuration key '${key}' must be ${allowUnbounded ? "-1 or " : ""}a whole number from ${bounds.min} to ${bounds.max}`
    );
  }
  return value as number;
};

const text = (model: ServerModel, key: string): string => {
  const value = model.configuration.get(key);
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Configuration key '${key}' must be non-empty text`);
  }
  return value;
};

export type AgentRunnerConfiguration = {
  readonly model: string;
  readonly topK: number;
  readonly maxSources: number;
  readonly maxToolRounds: number;
  readonly deadlineMs: number;
};

/** Exact required provision for the current grounded Agent runner. */
export const agentRunnerConfiguration = (model: ServerModel): AgentRunnerConfiguration => ({
  model: text(model, "intelligence.task.model"),
  topK: integer(model, "intelligence.task.topK", { min: 1, max: 20 }),
  maxSources: integer(model, "intelligence.task.maxSources", { min: 1, max: 40 }),
  maxToolRounds: integer(
    model,
    "intelligence.task.maxToolRounds",
    { min: 1, max: 100 },
    true
  ),
  deadlineMs: integer(model, "intelligence.task.deadlineMs", { min: 1_000, max: 3_600_000 })
});

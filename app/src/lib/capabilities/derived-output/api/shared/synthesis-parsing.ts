import type { EvidenceSelection } from "$capabilities/derived-output/api/shared/synthesis-types";

export const record = (value: unknown, message: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
};

export const queryInput = (
  value: unknown,
  defaultTopK: number
): { query: string; topK: number } => {
  const candidate = record(value, "retrieve input must be an object");
  if (typeof candidate.query !== "string" || !candidate.query.trim()) {
    throw new Error("retrieve query must not be blank");
  }
  if (candidate.query.length > 2_000) throw new Error("retrieve query is too long");
  const topK = candidate.topK ?? defaultTopK;
  if (!Number.isInteger(topK) || (topK as number) < 1 || (topK as number) > 20) {
    throw new Error("retrieve topK must be an integer from 1 through 20");
  }
  return { query: candidate.query.trim(), topK: topK as number };
};

export const materialQueryInput = (value: unknown, defaultTopK: number) => {
  const candidate = queryInput(value, defaultTopK);
  const raw = record(value, "retrieve_materials input must be an object");
  const supported = new Set(["table", "csv", "chart", "image", "code"]);
  const kinds =
    raw.kinds === undefined
      ? undefined
      : Array.isArray(raw.kinds) && raw.kinds.every((kind) => supported.has(String(kind)))
        ? [
            ...new Set(
              raw.kinds as Array<"table" | "csv" | "chart" | "image" | "code">
            )
          ]
        : (() => {
            throw new Error("retrieve_materials kinds are invalid");
          })();
  return { ...candidate, ...(kinds === undefined ? {} : { kinds }) };
};

export type SynthesisDecision = {
  status: "answered" | "insufficient";
  response: string;
  evidence: EvidenceSelection[];
};

const evidenceSelections = (value: unknown, label: string): EvidenceSelection[] => {
  if (!Array.isArray(value) || value.length > 200) {
    throw new Error(`${label} evidence must be an array of at most 200 items`);
  }
  return value.map((entry) => {
    const selection = record(entry, `${label} evidence selection must be an object`);
    if (typeof selection.evidenceId !== "string" || !selection.evidenceId.trim()) {
      throw new Error(`${label} evidence id must not be blank`);
    }
    if (typeof selection.use !== "string" || !selection.use.trim()) {
      throw new Error(`${label} evidence use must not be blank`);
    }
    return {
      evidenceId: selection.evidenceId.trim(),
      use: selection.use.trim()
    };
  });
};

export const synthesisDecision = (value: unknown): SynthesisDecision => {
  const candidate = record(value, "synthesis decision must be an object");
  if (candidate.status !== "answered" && candidate.status !== "insufficient") {
    throw new Error("synthesis decision has an invalid status");
  }
  if (typeof candidate.response !== "string") {
    throw new Error("synthesis decision response must be text");
  }
  return {
    status: candidate.status,
    response: candidate.response,
    evidence: evidenceSelections(candidate.evidence, "synthesis")
  };
};

const evidenceSchema = {
  type: "array",
  maxItems: 200,
  items: {
    type: "object",
    properties: { evidenceId: { type: "string" }, use: { type: "string" } },
    required: ["evidenceId", "use"],
    additionalProperties: false
  }
} as const;

export const synthesisSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["answered", "insufficient"] },
    response: { type: "string" },
    evidence: evidenceSchema
  },
  required: ["status", "response", "evidence"],
  additionalProperties: false
} as const;

export type VariableDecision = {
  name: string;
  status: "answered" | "insufficient";
  value: string;
  evidence: EvidenceSelection[];
};

const variableDecision = (value: unknown): VariableDecision => {
  const candidate = record(value, "derived variable decision must be an object");
  if (typeof candidate.name !== "string" || !candidate.name.trim()) {
    throw new Error("derived variable decision name must not be blank");
  }
  if (candidate.status !== "answered" && candidate.status !== "insufficient") {
    throw new Error("derived variable decision has an invalid status");
  }
  if (typeof candidate.value !== "string") {
    throw new Error("derived variable decision value must be text");
  }
  return {
    name: candidate.name.trim(),
    status: candidate.status,
    value: candidate.value,
    evidence: evidenceSelections(candidate.evidence, "derived variable")
  };
};

export const templateDecision = (value: unknown): { variables: VariableDecision[] } => {
  const candidate = record(value, "templated synthesis decision must be an object");
  if (!Array.isArray(candidate.variables) || candidate.variables.length > 32) {
    throw new Error("templated synthesis variables must be an array of at most 32 items");
  }
  return { variables: candidate.variables.map(variableDecision) };
};

export const templateSchema = {
  type: "object",
  properties: {
    variables: {
      type: "array",
      maxItems: 32,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          status: { type: "string", enum: ["answered", "insufficient"] },
          value: { type: "string" },
          evidence: evidenceSchema
        },
        required: ["name", "status", "value", "evidence"],
        additionalProperties: false
      }
    }
  },
  required: ["variables"],
  additionalProperties: false
} as const;

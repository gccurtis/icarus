/**
 * What the model is asked to answer with, and how that answer is admitted.
 *
 * The schema and the parser are one concern: a shape the provider enforces on
 * the way out, and the same shape checked again on the way in, because a
 * provider that drifts is a wrong answer rather than a failed request.
 */

export type Decision = {
  status: "answered" | "insufficient";
  response: string;
  findings: Array<{ text: string; sourceIds: string[] }>;
  sources: Array<{ sourceId: string; use: string }>;
};

/**
 * Sources first, on purpose.
 *
 * A strict schema is generated in property order, so naming the evidence before
 * writing the prose makes the answer follow the sources rather than the sources
 * be recalled after the fact.
 */
export const DECISION_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["answered", "insufficient"] },
    sources: {
      type: "array",
      maxItems: 24,
      items: {
        type: "object",
        properties: { sourceId: { type: "string" }, use: { type: "string" } },
        required: ["sourceId", "use"],
        additionalProperties: false
      }
    },
    response: { type: "string" },
    findings: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          sourceIds: { type: "array", maxItems: 12, items: { type: "string" } }
        },
        required: ["text", "sourceIds"],
        additionalProperties: false
      }
    }
  },
  required: ["status", "sources", "response", "findings"],
  additionalProperties: false
} as const;

const record = (value: unknown, message: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
};

const exactRecord = (
  value: unknown,
  fields: readonly string[],
  message: string
): Record<string, unknown> => {
  const admitted = record(value, message);
  const keys = Object.keys(admitted);
  if (keys.length !== fields.length || fields.some((field) => !Object.hasOwn(admitted, field))) {
    throw new Error(message);
  }
  return admitted;
};

const text = (value: unknown, message: string): string => {
  if (typeof value !== "string") throw new Error(message);
  return value;
};

export const parseDecision = (value: unknown): Decision => {
  const answer = exactRecord(
    value,
    ["status", "sources", "response", "findings"],
    "the answer must have exactly status, sources, response and findings"
  );
  if (answer.status !== "answered" && answer.status !== "insufficient") {
    throw new Error("the answer has an invalid status");
  }
  if (!Array.isArray(answer.findings) || answer.findings.length > 6) {
    throw new Error("the answer findings must be an array of at most six findings");
  }
  if (!Array.isArray(answer.sources) || answer.sources.length > 24) {
    throw new Error("the answer sources must be an array of at most 24 sources");
  }
  return {
    status: answer.status,
    response: text(answer.response, "the answer must carry a response"),
    findings: answer.findings.map((entry) => {
      const finding = exactRecord(
        entry,
        ["text", "sourceIds"],
        "a finding must have exactly text and sourceIds"
      );
      if (!Array.isArray(finding.sourceIds) || finding.sourceIds.length > 12) {
        throw new Error("a finding sourceIds must be an array of at most 12 strings");
      }
      return {
        text: text(finding.text, "a finding must carry text"),
        sourceIds: finding.sourceIds.map((sourceId) =>
          text(sourceId, "a finding sourceId must be a string")
        )
      };
    }),
    sources: answer.sources.map((entry) => {
      const source = exactRecord(
        entry,
        ["sourceId", "use"],
        "a source must have exactly sourceId and use"
      );
      return {
        sourceId: text(source.sourceId, "a source must carry a sourceId"),
        use: text(source.use, "a source must say what it was used for")
      };
    })
  };
};

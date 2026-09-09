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

const text = (value: unknown, message: string): string => {
  if (typeof value !== "string") throw new Error(message);
  return value;
};

export const parseDecision = (value: unknown): Decision => {
  const answer = record(value, "the answer must be an object");
  if (answer.status !== "answered" && answer.status !== "insufficient") {
    throw new Error("the answer has an invalid status");
  }
  const findings = Array.isArray(answer.findings) ? answer.findings : [];
  const sources = Array.isArray(answer.sources) ? answer.sources : [];
  return {
    status: answer.status,
    response: text(answer.response, "the answer must carry a response"),
    findings: findings.map((entry) => {
      const finding = record(entry, "a finding must be an object");
      return {
        text: text(finding.text, "a finding must carry text"),
        sourceIds: (Array.isArray(finding.sourceIds) ? finding.sourceIds : []).map(String)
      };
    }),
    sources: sources.map((entry) => {
      const source = record(entry, "a source must be an object");
      return {
        sourceId: text(source.sourceId, "a source must carry a sourceId"),
        use: text(source.use, "a source must say what it was used for")
      };
    })
  };
};

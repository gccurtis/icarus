import { describe, expect, it } from "vitest";

import { parseDecision } from "$capabilities/research-chat/api/shared/decision";

const currentDecision = () => ({
  status: "answered",
  sources: [{ sourceId: "source-1", use: "Established the count." }],
  response: "Three apples remain.",
  findings: [{ text: "Three apples remain.", sourceIds: ["source-1"] }]
});

describe("research decision admission", () => {
  it("admits the exact current provider result", () => {
    expect(parseDecision(currentDecision())).toEqual(currentDecision());
  });

  it.each([
    { ...currentDecision(), retired: true },
    { status: "answered", sources: [], response: "Missing findings." },
    { ...currentDecision(), findings: undefined },
    { ...currentDecision(), findings: [{ text: "Claim", sourceIds: undefined }] },
    { ...currentDecision(), findings: [{ text: "Claim", sourceIds: [1] }] },
    {
      ...currentDecision(),
      findings: [{ text: "Claim", sourceIds: [{ toString: () => "source-1" }] }]
    },
    { ...currentDecision(), sources: [{ sourceId: "source-1", use: "Used", old: true }] }
  ])("rejects a non-current result %#", (value) => {
    expect(() => parseDecision(value)).toThrow();
  });
});

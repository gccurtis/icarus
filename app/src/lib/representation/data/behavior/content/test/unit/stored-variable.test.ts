import { describe, expect, it } from "vitest";
import { isStoredVariable } from "$representation/data/behavior/content/stored-variable";

const variable = () => ({
  _id: "variables:1",
  _creationTime: 1,
  projectId: "default",
  name: "rate",
  value: { kind: "number", value: 3.1 },
  type: "number",
  description: "Cost per minute",
  createdBy: { kind: "user", userId: "users:1" },
  updatedAt: 2
});

describe("current variable storage", () => {
  it("admits a complete value whose declared type it satisfies", () => {
    expect(isStoredVariable(variable())).toBe(true);
  });

  it("rejects mismatched declarations, partial values, unknown fields, and coerced kinds", () => {
    expect(isStoredVariable({ ...variable(), type: "text" })).toBe(false);
    expect(isStoredVariable({ ...variable(), value: { kind: "number" } })).toBe(false);
    expect(isStoredVariable({ ...variable(), oldValue: 3.1 })).toBe(false);
    expect(isStoredVariable({ ...variable(), type: { toString: () => "number" } })).toBe(false);
  });
});

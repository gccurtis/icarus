import { describe, expect, it } from "vitest";
import type { Doc } from "$convex/_generated/dataModel";
import { asVariable } from "$name-manager/api/shared/as-variable";

const row = {
  _id: "nameVariables:1",
  _creationTime: 0,
  projectId: "projects:1",
  nameKey: "target margin",
  name: "Target Margin",
  declaredType: "number",
  value: { kind: "number", value: 42 },
  definitionOrder: 1,
  createdBy: { kind: "user", userId: "users:1" },
  updatedAt: 1_700_000_000_000
} as unknown as Doc<"nameVariables">;

describe("asVariable", () => {
  it("leaves the project behind, because a caller already knows which one it asked about", () => {
    expect(asVariable(row)).not.toHaveProperty("projectId");
  });

  it("keeps both forms of the name and the row's id", () => {
    expect(asVariable(row)).toMatchObject({
      id: "nameVariables:1",
      name: "Target Margin",
      nameKey: "target margin"
    });
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const commandSources = {
  createDerivedOutput: "../../api/create-derived-output/create-derived-output.ts",
  createTemplatedDerivedOutput:
    "../../api/create-templated-derived-output/create-templated-derived-output.ts",
  refreshDerivedOutput: "../../api/refresh-derived-output/refresh-derived-output.ts",
  updateDerivedOutput: "../../api/update-derived-output/update-derived-output.ts"
} as const;

describe("cross-project Derived Output ownership", () => {
  test("createDerivedOutput, createTemplatedDerivedOutput, refreshDerivedOutput, and updateDerivedOutput bind every write to the request scope", () => {
    for (const path of Object.values(commandSources)) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toContain("const scope = await requireScope()");
      expect(source).toContain("scope.projectId");
    }
  });
});

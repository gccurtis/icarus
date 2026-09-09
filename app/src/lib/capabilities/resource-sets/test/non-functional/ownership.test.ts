import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const commandSources = {
  createResourceSet: "../../api/create-resource-set/create-resource-set.ts",
  removeResourceSet: "../../api/remove-resource-set/remove-resource-set.ts",
  updateResourceSet: "../../api/update-resource-set/update-resource-set.ts"
} as const;

describe("cross-project Resource Set ownership", () => {
  test("createResourceSet, removeResourceSet, and updateResourceSet resolve subjects through the request scope", () => {
    for (const path of Object.values(commandSources)) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toContain("const scope = await requireScope()");
      expect(source).toMatch(/scope\.projectId|visibleSet\(store, scope/);
    }
  });
});

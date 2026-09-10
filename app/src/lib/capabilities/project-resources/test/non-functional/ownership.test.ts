import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const commandSources = {
  createProjectResource: "../../api/create-project-resource/create-project-resource.ts",
  renameProjectResource: "../../api/rename-project-resource/rename-project-resource.ts"
} as const;

describe("cross-project Project Resources ownership", () => {
  test("createProjectResource and renameProjectResource derive every write owner from request scope", () => {
    for (const path of Object.values(commandSources)) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toContain("const scope = await requireScope()");
      expect(source).toContain("scope.projectId");
      expect(source).not.toContain("asked.projectId");
    }
  });
});

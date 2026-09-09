import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const commandSources = {
  commitTemplateStage: "../../api/commit-template-stage/commit-template-stage.ts",
  createTemplate: "../../api/create-template/create-template.ts",
  createTemplateFromResource:
    "../../api/create-template-from-resource/create-template-from-resource.ts",
  discardTemplateStage: "../../api/discard-template-stage/discard-template-stage.ts",
  duplicateTemplate: "../../api/duplicate-template/duplicate-template.ts",
  instantiateTemplate: "../../api/instantiate-template/instantiate-template.ts",
  openTemplateStage: "../../api/open-template-stage/open-template-stage.ts",
  removeTemplate: "../../api/remove-template/remove-template.ts",
  updateTemplate: "../../api/update-template/update-template.ts"
} as const;

describe("cross-project Template ownership", () => {
  test("commitTemplateStage, createTemplate, createTemplateFromResource, discardTemplateStage, duplicateTemplate, instantiateTemplate, openTemplateStage, removeTemplate, and updateTemplate resolve every subject in the request project", () => {
    for (const path of Object.values(commandSources)) {
      const source = readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toContain("const scope = await requireScope()");
      expect(source).toContain("scope.projectId");
    }
  });
});

import assert from "node:assert/strict";
import { test } from "vitest";
import type { ReadResourceTemplateResult } from "$capabilities/templates/index.remote";
import {
  evidenceTitles,
  resourceName,
  type ResourceIndexQuery
} from "$app-views/categories/presentation-editor/procedures/resource-index";

const index = (resources: readonly object[]) =>
  ({ current: { resources } }) as unknown as ResourceIndexQuery;

const stage = (templateName: string): ReadResourceTemplateResult => ({
  resourceId: "presentations:stage",
  stage: {
    stageId: "templateStages:stage",
    templateId: "templates:stage",
    templateName,
    target: "presentation",
    stagedRevision: 1,
    currentRevision: 1
  }
});

test("a staged presentation has a title even though the project resource index hides working copies", () => {
  assert.equal(
    resourceName(
      index([{ id: "presentations:stage", name: "Not the stage identity" }]),
      "presentations:stage",
      stage("Board review")
    ),
    "Template · Board review"
  );
});

test("an ordinary presentation keeps its indexed title", () => {
  assert.equal(
    resourceName(index([{ id: "presentations:1", name: "Q1 review" }]), "presentations:1"),
    "Q1 review"
  );
});

test("a stage answer for another resource is not a name fallback", () => {
  assert.equal(
    resourceName(index([{ id: "presentations:1", name: "Current presentation" }]), "presentations:1", stage("Other")),
    "Current presentation"
  );
});

test("evidence titles preserve an External file's exact represented kind", () => {
  const resources = index([
    {
      id: "externalFiles:1",
      name: "presentation-prompt-evidence.md",
      kind: "file",
      ref: { kind: "externalFile::text", id: "externalFiles:1" }
    }
  ]);

  assert.equal(
    evidenceTitles(resources).get("externalFile::text:externalFiles:1"),
    "presentation-prompt-evidence.md"
  );
});

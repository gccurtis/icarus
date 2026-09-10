import assert from "node:assert/strict";
import { test } from "vitest";
import type { ReadResourceTemplateResult } from "$capabilities/templates/index.remote";
import {
  resourceName,
  type ResourceIndexQuery
} from "$app-views/categories/document-editor/procedures/resource-index";

const index = (resources: readonly { readonly id: string; readonly name: string }[]) =>
  ({ current: { resources } }) as unknown as ResourceIndexQuery;

const stage = (templateName: string): ReadResourceTemplateResult => ({
  resourceId: "documents:stage",
  stage: {
    stageId: "templateStages:stage",
    templateId: "templates:stage",
    templateName,
    target: "document",
    stagedRevision: 1,
    currentRevision: 1
  }
});

test("a staged document has a title even though the project resource index hides working copies", () => {
  assert.equal(
    resourceName(
      index([{ id: "documents:stage", name: "Not the stage identity" }]),
      "documents:stage",
      stage("Decision record")
    ),
    "Template · Decision record"
  );
});

test("an ordinary document keeps its indexed title", () => {
  assert.equal(
    resourceName(index([{ id: "documents:1", name: "Winter brief" }]), "documents:1"),
    "Winter brief"
  );
});

test("a stage answer for another resource is not a name fallback", () => {
  assert.equal(
    resourceName(index([{ id: "documents:1", name: "Current document" }]), "documents:1", stage("Other")),
    "Current document"
  );
});

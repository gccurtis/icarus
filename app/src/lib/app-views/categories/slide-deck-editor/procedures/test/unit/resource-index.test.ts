import assert from "node:assert/strict";
import { test } from "vitest";
import type { ReadResourceTemplateResult } from "$capabilities/templates/index.remote";
import {
  resourceName,
  type ResourceIndexQuery
} from "$app-views/categories/slide-deck-editor/procedures/resource-index";

const index = (resources: readonly { readonly id: string; readonly name: string }[]) =>
  ({ current: { resources } }) as unknown as ResourceIndexQuery;

const stage = (templateName: string): ReadResourceTemplateResult => ({
  resourceId: "slideDecks:stage",
  stage: {
    stageId: "templateStages:stage",
    templateId: "templates:stage",
    templateName,
    target: "slides",
    stagedRevision: 1,
    currentRevision: 1
  }
});

test("a staged deck has a title even though the project resource index hides working copies", () => {
  assert.equal(
    resourceName(
      index([{ id: "slideDecks:stage", name: "Not the stage identity" }]),
      "slideDecks:stage",
      stage("Board review")
    ),
    "Template · Board review"
  );
});

test("an ordinary deck keeps its indexed title", () => {
  assert.equal(
    resourceName(index([{ id: "slideDecks:1", name: "Q1 review" }]), "slideDecks:1"),
    "Q1 review"
  );
});

test("a stage answer for another resource is not a name fallback", () => {
  assert.equal(
    resourceName(index([{ id: "slideDecks:1", name: "Current deck" }]), "slideDecks:1", stage("Other")),
    "Current deck"
  );
});

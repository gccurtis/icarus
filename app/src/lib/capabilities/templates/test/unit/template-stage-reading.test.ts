import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  model,
  openTemplateStage,
  readResourceTemplate,
  readTemplateStageIndex,
  row
} from "$capabilities/templates/test/unit/template-stage-fixture";

describe("reading what a resource is", () => {
  test("names the stage, and nothing for a plain resource", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    model.tables.documents.push(row("documents", "10", { projectId: "projects:p", title: "Plain" }));

    assert.deepEqual(await readResourceTemplate({ resourceId: "documents:1" }), {
      resourceId: "documents:1",
      stage: {
        stageId: "templateStages:1",
        templateId: "templates:1",
        templateName: "Template 1",
        target: "document",
        stagedRevision: 2,
        currentRevision: 2
      }
    });
    assert.deepEqual(await readResourceTemplate({ resourceId: "documents:10" }), {
      resourceId: "documents:10",
      stage: null
    });
  });

  test("indexes only exact live stage identities in the current project", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    await openTemplateStage({ templateId: "templates:2" });

    assert.deepEqual(await readTemplateStageIndex(), {
      stages: [
        {
          stageId: "templateStages:1",
          templateId: "templates:1",
          templateName: "Template 1",
          target: "document",
          resourceId: "documents:1"
        },
        {
          stageId: "templateStages:2",
          templateId: "templates:2",
          templateName: "Template 2",
          target: "presentation",
          resourceId: "presentations:1"
        }
      ],
      unavailable: []
    });

    model.scope = { projectId: "projects:other", userId: "users:u", username: "Uma" };
    assert.deepEqual(await readTemplateStageIndex(), { stages: [], unavailable: [] });
  });
});

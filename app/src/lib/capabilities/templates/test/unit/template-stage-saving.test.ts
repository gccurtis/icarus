import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  commitTemplateStage,
  presentationBody,
  model,
  openTemplateStage,
  row,
  template,
  text
} from "$capabilities/templates/test/unit/template-stage-fixture";

describe("saving a stage", () => {
  test("writes the scratch body into the template as the next revision, made portable", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    model.tables.documentSnapshots[0].body = {
      rows: [
        {
          id: "r1",
          kind: "blocks",
          blocks: [
            {
              ...text("b1", "Edited"),
              marks: [
                { id: "m1", from: { atom: "b1-a", offset: 0 }, to: { atom: "b1-a", offset: 2 }, link: { kind: "resource", ref: { kind: "document", id: "documents:4" } } }
              ]
            },
            {
              id: "p1",
              type: "prompt",
              atoms: [{ id: "p1-a", kind: "literal", text: "Sum up" }],
              display: "Sum up",
              prompt: "Sum up",
              marks: [],
              scope: { include: [{ select: "hole", name: "evidence" }], exclude: [] },
              state: "idle"
            }
          ]
        }
      ]
    };

    const saved = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });
    assert.deepEqual(saved, {
      accepted: true,
      stageId: "templateStages:1",
      templateId: "templates:1",
      revision: 3,
      dropped: ["Dropped a link to something in the project."]
    });
    const held = model.tables.templates[0];
    assert.equal(held.revision, 3);
    assert.deepEqual((held.body as { rows: unknown[] }).rows.length, 1);
    assert.deepEqual(held.holes, [{ name: "evidence", label: "evidence", kind: "scope" }]);
    assert.equal(model.tables.templateVersions.length, 1);
    assert.equal(model.tables.templateStages[0].templateRevision, 3);

    const stale = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });
    assert.equal(stale.accepted, false);
    assert.equal(stale.accepted === false && stale.reason, "stale");
  });

  test("refuses a staged prompt scope owned by another resource", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    model.tables.documentSnapshots[0].body = {
      rows: [
        {
          id: "r1",
          kind: "blocks",
          blocks: [
            {
              id: "p1",
              type: "prompt",
              atoms: [{ id: "p1-a", kind: "literal", text: "Sum up" }],
              display: "Sum up",
              marks: [],
              derivedOutputId: "derivedOutputs:1",
              hole: { name: "evidence" },
              state: "idle"
            }
          ]
        }
      ]
    };
    model.tables.derivedOutputs = [
      row("derivedOutputs", "1", {
        projectId: "projects:p",
        prompt: "What matters?",
        scope: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
      })
    ];
    model.tables.resourceSets.push(
      row("resourceSets", "1", {
        projectId: "projects:p",
        boundTo: {
          kind: "resource",
          ref: { kind: "document", id: "documents:9" },
          hole: "evidence"
        },
        set: {
          include: [{ select: "resources", refs: [{ kind: "document", id: "documents:9" }] }],
          exclude: []
        },
        createdBy: { kind: "user", userId: "users:u" },
        revision: 1,
        updatedAt: 1
      })
    );

    const saved = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });

    assert.equal(saved.accepted, false);
    assert.equal(saved.accepted ? "" : saved.reason, "unsupported-body");
    assert.match(saved.accepted ? "" : saved.detail, /private/);
    assert.equal(model.tables.templates[0].revision, 2);
    assert.deepEqual(model.tables.templateVersions, []);
  });

  test("saves a presentation stage back however many slides it holds now", async () => {
    await openTemplateStage({ templateId: "templates:2" });
    model.tables.presentationSnapshots[0].body = {
      ...presentationBody,
      slides: [
        { id: "s1", elements: [], notes: [] },
        { id: "s2", elements: [], notes: [] }
      ]
    };
    delete (model.tables.presentationSnapshots[0].body as Record<string, unknown>).resource;

    const saved = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });
    assert.ok(saved.accepted);
    assert.equal((model.tables.templates[1].body as { slides: unknown[] }).slides.length, 2);
  });

  test("refuses to save a stage from another project", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    model.scope = { projectId: "projects:other", userId: "users:u", username: "Uma" };
    const saved = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });
    assert.equal(saved.accepted === false && saved.reason, "not-found");
  });
});

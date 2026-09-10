import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  discardTemplateStage,
  model,
  openTemplateStage,
  removeTemplate,
  row,
  template,
  text
} from "$capabilities/templates/test/unit/template-stage-fixture";

describe("discarding a stage", () => {
  test("removes the stage and everything the scratch resource accumulated", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    model.tables.documentChangeSets.push(
      row("documentChangeSets", "1", {
        projectId: "projects:p",
        resourceId: "documents:1",
        revision: 1,
        baseRevision: 0,
        tier: "recent",
        ops: [{
          op: "set",
          target: "document",
          path: "title",
          value: "Template draft",
          was: "Template"
        }],
        touched: ["title"],
        actor: { kind: "system" },
        at: 1
      })
    );
    model.tables.commentThreads.push(
      row("commentThreads", "1", {
        projectId: "projects:p",
        target: { kind: "document", id: "documents:1" },
        createdBy: { kind: "system" },
        updatedAt: 1
      }),
      row("commentThreads", "2", {
        projectId: "projects:p",
        target: { kind: "document", id: "documents:7" },
        createdBy: { kind: "system" },
        updatedAt: 1
      })
    );
    model.tables.comments.push(
      row("comments", "1", {
        projectId: "projects:p",
        threadId: "commentThreads:1",
        blocks: [],
        mentions: [],
        author: { kind: "system" }
      }),
      row("comments", "2", {
        projectId: "projects:p",
        threadId: "commentThreads:2",
        blocks: [],
        mentions: [],
        author: { kind: "system" }
      })
    );

    const discarded = await discardTemplateStage({ stageId: "templateStages:1" });
    assert.deepEqual(discarded, {
      accepted: true,
      stageId: "templateStages:1",
      templateId: "templates:1",
      target: "document",
      resourceId: "documents:1"
    });
    assert.deepEqual(model.tables.templateStages, []);
    assert.deepEqual(model.tables.documents, []);
    assert.deepEqual(model.tables.documentSnapshots, []);
    assert.deepEqual(model.tables.documentChangeSets, []);
    assert.deepEqual(model.tables.commentThreads.map((thread) => thread._id), ["commentThreads:2"]);
    assert.deepEqual(model.tables.comments.map((comment) => comment._id), ["comments:2"]);
  });

  /**
   * A discarded draft must leave nothing an agent can still find.
   *
   * Ingestion refuses a stage, so in the ordinary case there is nothing here to
   * take back. These rows are what an earlier save, or a forced backfill, could
   * have left behind — and another resource's rows have to survive it.
   */
  test("takes back everything the overlay learned about the scratch resource", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    const mine = { kind: "document", id: "documents:1" };
    const other = { kind: "document", id: "documents:9" };
    const locator = {
      kind: "documentBlock",
      area: "body",
      rowId: "row",
      blockPath: ["table"]
    };
    const material = {
      projectId: "projects:p",
      identityKey: "stage-table",
      kind: "table",
      name: "Stage table",
      source: { kind: "resourceContent", ref: mine, revision: 1, locator },
      profile: {
        kind: "table",
        rows: 0,
        columns: 0,
        headerRows: 0,
        headers: [],
        columnsProfile: [],
        mergedRegions: 0,
        sample: [],
        warnings: []
      },
      profileHash: "profile",
      contextHash: "context",
      revisionKey: "revision:document:documents:1:1",
      state: "ready",
      updatedAt: 1
    };
    model.tables.semanticSyncJobs = [
      row("semanticSyncJobs", "1", {
        projectId: "projects:p",
        ref: mine,
        requestedRevision: 1,
        state: "queued",
        attempts: 0,
        queuedAt: 1,
        updatedAt: 1
      }),
      row("semanticSyncJobs", "2", {
        projectId: "projects:p",
        ref: other,
        requestedRevision: 1,
        state: "queued",
        attempts: 0,
        queuedAt: 1,
        updatedAt: 1
      })
    ];
    model.tables.semanticMaterialJobs = [
      row("semanticMaterialJobs", "1", {
        projectId: "projects:p",
        ref: mine,
        requestedRevision: 1,
        state: "queued",
        attempts: 0,
        queuedAt: 1,
        updatedAt: 1
      })
    ];
    model.tables.semanticSources = [
      row("semanticSources", "1", {
        projectId: "projects:p",
        ref: mine,
        revision: 1,
        encoding: "utf-8",
        updatedAt: 1
      }),
      row("semanticSources", "2", {
        projectId: "projects:p",
        ref: other,
        revision: 1,
        encoding: "utf-8",
        updatedAt: 1
      })
    ];
    model.tables.semanticMaterials = [
      row("semanticMaterials", "1", material)
    ];
    model.tables.semanticMaterialPlacements = [
      row("semanticMaterialPlacements", "1", {
        projectId: "projects:p",
        semanticMaterialId: "semanticMaterials:1",
        ref: mine,
        revision: 1,
        locator,
        context: { nearbyText: [], notes: [] },
        contextHash: "context",
        updatedAt: 1
      })
    ];
    model.tables.semanticMaterialHistory = [
      row("semanticMaterialHistory", "1", {
        projectId: "projects:p",
        retiredGeneration: 1,
        material,
        retiredAt: 1
      })
    ];
    model.tables.semanticObjects = [
      row("semanticObjects", "1", {
        projectId: "projects:p",
        lane: "text",
        semanticSourceId: "semanticSources:1",
        span: { from: 0, to: 1, text: "x" },
        vector: [1]
      }),
      row("semanticObjects", "2", {
        projectId: "projects:p",
        lane: "material",
        semanticMaterialId: "semanticMaterials:1",
        facet: "profile",
        inputHash: "profile",
        vector: [1]
      }),
      row("semanticObjects", "3", {
        projectId: "projects:p",
        lane: "text",
        semanticSourceId: "semanticSources:2",
        span: { from: 0, to: 1, text: "y" },
        vector: [1]
      })
    ];

    await discardTemplateStage({ stageId: "templateStages:1" });

    assert.deepEqual(model.tables.semanticSyncJobs.map((job) => job._id), ["semanticSyncJobs:2"]);
    assert.deepEqual(model.tables.semanticMaterialJobs, []);
    assert.deepEqual(model.tables.semanticSources.map((source) => source._id), ["semanticSources:2"]);
    assert.deepEqual(model.tables.semanticMaterials, []);
    assert.deepEqual(model.tables.semanticMaterialPlacements, []);
    assert.deepEqual(model.tables.semanticMaterialHistory, []);
    assert.deepEqual(model.tables.semanticObjects.map((held) => held._id), ["semanticObjects:3"]);
  });

  test("goes with the template when the template is deleted, and is out of reach from another project", async () => {
    await openTemplateStage({ templateId: "templates:1" });

    model.scope = { projectId: "projects:other", userId: "users:u", username: "Uma" };
    const elsewhere = await removeTemplate({ templateId: "templates:1", baseRevision: 2 });
    assert.equal(elsewhere.accepted === false && elsewhere.reason, "not-found");

    model.scope = { projectId: "projects:p", userId: "users:u", username: "Uma" };
    const here = await removeTemplate({ templateId: "templates:1", baseRevision: 2 });
    assert.equal(here.accepted, true);
    assert.deepEqual(model.tables.templateStages, []);
    assert.deepEqual(model.tables.documents, []);
    assert.deepEqual(model.tables.templates.map((held) => held._id), ["templates:2"]);
  });
});

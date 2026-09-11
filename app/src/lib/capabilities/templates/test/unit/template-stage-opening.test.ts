import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  commitTemplateStage,
  documentBody,
  enqueueSemanticSync,
  model,
  openTemplateStage,
  readResourceTemplate,
  readTemplate,
  readTemplateLibrary,
  row,
  template,
  updateTemplate
} from "$capabilities/templates/test/unit/template-stage-fixture";

describe("opening a stage", () => {
  test("makes a scratch document holding the template body and a stage row, once", async () => {
    const opened = await openTemplateStage({ templateId: "templates:1" });
    assert.deepEqual(opened, {
      accepted: true,
      stageId: "templateStages:1",
      templateId: "templates:1",
      templateRevision: 2,
      target: "document",
      resourceId: "documents:1",
      reused: false
    });
    assert.equal(model.tables.documents[0].title, "Template · Template 1");
    assert.equal("templateId" in model.tables.documents[0], false);
    assert.deepEqual(model.tables.documentSnapshots[0].body, { rows: documentBody.rows });
    assert.deepEqual(model.tables.templateStages[0], {
      _id: "templateStages:1",
      _creationTime: 1,
      projectId: "projects:p",
      templateId: "templates:1",
      templateRevision: 2,
      target: "document",
      resourceId: "documents:1",
      createdBy: { kind: "user", userId: "users:u" },
      updatedAt: 500
    });

    const again = await openTemplateStage({ templateId: "templates:1" });
    assert.deepEqual(again, { ...opened, reused: true });
    assert.equal(model.tables.documents.length, 1);

    const library = await readTemplateLibrary();
    assert.deepEqual(library.templates.map((item) => item.id), ["templates:1", "templates:2"]);
    const detail = await readTemplate({ templateId: "templates:1" });
    assert.ok(detail !== null && !("unavailable" in detail));
    assert.equal("stage" in detail, false);
  });

  /**
   * A working copy is a draft of a template, not the project's material.
   *
   * The copy is an ordinary document, so saving it takes the ordinary path and
   * would put unfinished template words in front of every agent that retrieves.
   */
  test("is refused by the overlay, however the question is asked", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    model.tables.documents.push(
      row("documents", "9", { projectId: "projects:p", title: "A real document" })
    );
    model.tables.documentSnapshots.push(
      row("documentSnapshots", "9", {
        projectId: "projects:p",
        resourceId: "documents:9",
        role: "leader",
        revision: 1,
        body: { rows: [] }
      })
    );

    assert.equal(await enqueueSemanticSync({ ref: { kind: "document", id: "documents:1" } }), null);
    assert.deepEqual(model.tables.semanticSyncJobs ?? [], []);

    const real = await enqueueSemanticSync({ ref: { kind: "document", id: "documents:9" } });
    assert.notEqual(real, null);
    assert.deepEqual(
      (model.tables.semanticSyncJobs ?? []).map((job) => job.ref),
      [{ kind: "document", id: "documents:9" }]
    );
  });

  test("is shared by everyone in the project rather than kept per viewer", async () => {
    const opened = await openTemplateStage({ templateId: "templates:1" });
    assert.ok(opened.accepted);
    const read = await readResourceTemplate({ resourceId: "documents:1" });
    assert.equal(read.stage?.stageId, "templateStages:1");
    assert.equal("mine" in (read.stage ?? {}), false);

    model.scope = { projectId: "projects:p", userId: "users:v", username: "Victor" };
    const saved = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });
    assert.equal(saved.accepted, true);
    assert.equal(model.tables.templates[0].revision, 3);
  });

  test("a name or hole edit carries every stage of the template to the new revision", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    const renamed = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 2,
      patch: { name: "Renamed" }
    });
    assert.ok(renamed.accepted);
    assert.equal(model.tables.templateStages[0].templateRevision, 3);
    const read = await readResourceTemplate({ resourceId: "documents:1" });
    assert.equal(read.stage?.stagedRevision, 3);
    assert.equal(read.stage?.currentRevision, 3);
  });

  test("stages a presentation template as a presentation and refuses a spreadsheet", async () => {
    const opened = await openTemplateStage({ templateId: "templates:2" });
    assert.ok(opened.accepted);
    assert.equal(opened.target, "presentation");
    assert.equal(model.tables.presentations[0].title, "Template · Template 2");
    assert.equal((model.tables.presentationSnapshots[0].body as { slides: unknown[] }).slides.length, 1);

    model.tables.templates.push(
      template("3", {
        resource: "spreadsheet",
        cells: {},
        formatRules: [],
        print: { page: { paper: "letter", orientation: "portrait", margins: { top: 1, right: 1, bottom: 1, left: 1 } } },
        styles: { defaultKey: "body", styles: { body: { name: "Body" } } }
      })
    );
    const refused = await openTemplateStage({ templateId: "templates:3" });
    assert.deepEqual(refused, {
      accepted: false,
      templateId: "templates:3",
      reason: "unsupported-body",
      revision: 2,
      detail: "a spreadsheet template opens for editing once the spreadsheet editor lands"
    });
  });
});

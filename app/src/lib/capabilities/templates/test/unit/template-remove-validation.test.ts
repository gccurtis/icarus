import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { asId } from "$representation/data/behavior/core/id";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import {
  bodyOf,
  createTemplate,
  documentBody,
  duplicateTemplate,
  model,
  normalizeScope,
  removeTemplate,
  row,
  slidesBody,
  template,
  templateVersion,
  updateTemplate,
  withFreshOutputs
} from "$capabilities/templates/test/unit/template-fixture";

describe("template mutations — revision and removal boundaries", () => {
  test("refuses to advance an exhausted safe revision counter", async () => {
    model.tables.templates.push(
      template("1", "users:u", documentBody, { revision: Number.MAX_SAFE_INTEGER })
    );

    const answer = await updateTemplate({
      templateId: "templates:1",
      baseRevision: Number.MAX_SAFE_INTEGER,
      patch: { name: "Overflow" }
    });

    assert.deepEqual(answer, {
      accepted: false,
      templateId: "templates:1",
      reason: "unsupported-body",
      revision: Number.MAX_SAFE_INTEGER,
      detail: "the template revision counter is exhausted"
    });
    assert.equal(model.tables.templates[0].name, "Template 1");
    assert.equal(model.tables.templateVersions.length, 0);
  });

  test("keeps a generated copy name inside the represented name boundary", async () => {
    model.tables.templates.push(template("1", "users:u", slidesBody, { name: "x".repeat(160) }));

    const answer = await duplicateTemplate({ templateId: "templates:1" });

    assert.equal(answer.accepted, true);
    const copy = model.tables.templates.find((candidate) => candidate._id === "templates:2");
    assert.equal(typeof copy?.name === "string" && copy.name.length, 160);
    assert.equal(typeof copy?.name === "string" && copy.name.endsWith(" copy"), true);
  });

  test("deletes a template with its versions and leaves the resources made from it alone", async () => {
    model.tables.templates.push(template("1", "users:u"));
    model.tables.templateVersions.push(
      templateVersion("1", "templates:1", 1),
      templateVersion("2", "templates:1", 2)
    );
    model.tables.documents.push(
      row("documents", "1", {
        projectId: "projects:p",
        title: "Made from it",
        createdBy: { kind: "system" },
        updatedBy: { kind: "system" },
        updatedAt: 1
      })
    );

    assert.deepEqual(await removeTemplate({ templateId: "templates:1", baseRevision: 2 }), {
      accepted: true,
      templateId: "templates:1",
      revision: 2
    });
    assert.equal(model.tables.templates.length, 0);
    assert.equal(model.tables.templateVersions.length, 0);
    assert.equal(model.tables.documents.length, 1);
    assert.equal(model.tables.documents[0].title, "Made from it");
  });

  test("preflights corrupt version ids before removing anything", async () => {
    model.tables.templates.push(template("1", "users:u"));
    model.tables.templateVersions.push({
      _id: "templateVersions:bad.path",
      _creationTime: 1,
      templateId: "templates:1",
      revision: 2
    });

    await assert.rejects(
      () => removeTemplate({ templateId: "templates:1", baseRevision: 2 }),
      /one canonical id/
    );
    assert.equal(model.tables.templates.length, 1);
    assert.equal(model.tables.templateVersions.length, 1);
    assert.equal(model.calls.some((call) => call.startsWith("remove")), false);
  });

  test("refuses an ambiguous version id before deleting another template's history", async () => {
    model.tables.templates.push(template("1", "users:u"));
    model.tables.templateVersions.push(
      templateVersion("1", "templates:1", 2),
      templateVersion("1", "templates:other", 1)
    );

    await assert.rejects(
      () => removeTemplate({ templateId: "templates:1", baseRevision: 2 }),
      /repeats row id/
    );
    assert.equal(model.tables.templates.length, 1);
    assert.equal(model.tables.templateVersions.length, 2);
    assert.equal(model.calls.some((call) => call.startsWith("remove")), false);
  });

  test("refuses malformed input before touching the store", async () => {
    await assert.rejects(
      () => updateTemplate({ templateId: "templates:1", baseRevision: 1, patch: {} }),
      /patch changes at least one field/
    );
    await assert.rejects(
      () =>
        updateTemplate({
          templateId: "templates:1",
          baseRevision: 1,
          patch: { body: slidesBody }
        }),
      /unknown field body/
    );
    assert.deepEqual(model.calls, ["scope", "scope"]);
  });
});

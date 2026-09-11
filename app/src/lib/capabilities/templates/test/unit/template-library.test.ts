import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  type Row,
  documentBody,
  duplicateTemplate,
  model,
  readTemplate,
  readTemplateLibrary,
  row,
  slidesBody,
  template,
  updateTemplate
} from "$capabilities/templates/test/unit/template-fixture";

describe("the project library", () => {
  test("fails closed on a malformed table root", async () => {
    model.tables.templates = {} as Row[];

    await assert.rejects(() => readTemplateLibrary(), /table is an array/);
  });

  test("does not forward an unbounded referenced actor label", async () => {
    model.tables.templates.push(template("1", "users:u"));
    model.tables.users[0].displayName = "x".repeat(161);

    const answer = await readTemplateLibrary();

    assert.equal(answer.templates[0].createdByName, "Someone");
  });

  test("fails closed on duplicate ids across projects and malformed resource rows", async () => {
    model.tables.templates.push(
      template("1", "users:u", documentBody, {
        createdBy: { kind: "user", userId: "users:x" }
      }),
      template("1", "users:v", slidesBody, { projectId: "projects:other" })
    );
    model.tables.documents.push(null as unknown as Row);

    await assert.rejects(() => readTemplateLibrary(), /repeats row id/);
    await assert.rejects(() => readTemplate({ templateId: "templates:1" }), /repeats row id/);
  });

  test("resolves creator labels only through actors authorized in this project", async () => {
    model.tables.templates.push(
      template("1", "users:u", documentBody, {
        createdBy: { kind: "user", userId: "users:x" }
      })
    );

    const answer = await readTemplateLibrary();

    assert.equal(answer.templates[0].createdByName, "Someone");
    assert.equal("createdBy" in answer.templates[0], false);
    assert.equal("ownerId" in answer.templates[0], false);
    assert.equal("viewerId" in answer, false);
    assert.equal("projectId" in answer, false);
  });

  test("projects only this project's templates with project-local recency", async () => {
    model.tables.templates.push(
      template("1", "users:u", documentBody, { name: "Mine", updatedAt: 30, lastUsedAt: 80 }),
      template("2", "users:v", slidesBody, { name: "Shared", updatedAt: 40, lastUsedAt: 90 }),
      template("3", "users:x", documentBody, { name: "Hidden", updatedAt: 50, projectId: "projects:other" })
    );

    const answer = await readTemplateLibrary();

    assert.equal(model.calls[0], "scope");
    assert.deepEqual(answer.templates.map((item) => item.id), ["templates:2", "templates:1"]);
    assert.deepEqual(
      answer.templates.map((item) => [item.availability, item.createdByName, item.lastUsedAt]),
      [
        ["project", "Victor", 90],
        ["project", "Uma", 80]
      ]
    );
    assert.equal(answer.templates[0].canEdit, true);
    assert.equal(answer.templates[0].canDelete, true);
    assert.deepEqual(answer.unavailable, []);
  });

  test("reads a full body and does not disclose another project's template", async () => {
    model.tables.templates.push(
      template("1", "users:u", slidesBody),
      template("2", "users:v", documentBody, { projectId: "projects:other" })
    );

    const answer = await readTemplate({ templateId: "templates:1" });
    assert.ok(answer !== null && !("unavailable" in answer));
    assert.equal(answer.body.resource, "presentation");
    assert.equal(await readTemplate({ templateId: "templates:2" }), null);
  });

  test("refuses to read or duplicate a private default owned by another subject", async () => {
    model.tables.templates.push(
      template("1", "users:u", documentBody, {
        slots: [
          {
            name: "evidence",
            label: "Evidence",
            kind: "scope",
            default: {
              include: [{ select: "set", setId: "resourceSets:9" }],
              exclude: []
            }
          }
        ]
      })
    );
    model.tables.resourceSets.push(
      row("resourceSets", "9", {
        projectId: "projects:p",
        boundTo: {
          kind: "resource",
          ref: { kind: "document", id: "documents:9" },
          slot: "evidence"
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

    const selected = await readTemplate({ templateId: "templates:1" });
    const duplicated = await duplicateTemplate({ templateId: "templates:1" });

    assert.ok(selected !== null && "unavailable" in selected);
    assert.match(selected !== null && "unavailable" in selected ? selected.detail : "", /private/);
    assert.equal(duplicated.accepted, false);
    assert.equal(duplicated.accepted ? "" : duplicated.reason, "unsupported-body");
    assert.match(duplicated.accepted ? "" : duplicated.detail, /private/);
    assert.equal(model.tables.templates.length, 1);
    assert.equal(model.tables.resourceSets.length, 1);
  });

  test("fails closed on an invalid owned row", async () => {
    model.tables.templates.push(
      template("1", "users:u", documentBody, { name: "Healthy" }),
      template("2", "users:u", { resource: "document", blocks: [] }, { name: "Malformed" })
    );

    await assert.rejects(() => readTemplateLibrary(), /non-current field values/);
    await assert.rejects(
      () => readTemplate({ templateId: "templates:2" }),
      /non-current field values/
    );
  });

  test("fails closed on a path-like row id and rejects it at every input door", async () => {
    const legitimate = template("1", "users:u", documentBody, { description: "Keep me" });
    const disguised = {
      ...template("evil", "users:u", documentBody),
      _id: "templates:1.description"
    };
    model.tables.templates.push(legitimate, disguised);

    await assert.rejects(() => readTemplateLibrary(), /one canonical id/);
    await assert.rejects(
      () =>
        updateTemplate({
          templateId: "templates:1.description",
          baseRevision: 2,
          patch: { name: "Hijacked" }
        }),
      /one canonical templates row id/
    );
    assert.equal(model.tables.templates[0].description, "Keep me");
    assert.equal(model.calls.some((call) => call.startsWith("update ")), false);
  });
});

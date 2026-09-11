import assert from "node:assert/strict";
import { describe, test } from "vitest";
import type { StoreUnitOfWork } from "$model/server/store/index.server";
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

describe("template mutations — create, update, and duplicate", () => {
  test("creates every target from a server-owned valid empty body and records revision one", async () => {
    for (const target of ["document", "presentation", "spreadsheet"] as const) {
      const answer = await createTemplate({ target, name: `New ${target}`, tags: [" New ", "new"] });
      assert.equal(answer.accepted, true);
      const created = model.tables.templates.find((candidate) => candidate._id === answer.templateId);
      assert.equal((created?.body as { resource: string }).resource, target);
      assert.deepEqual(created?.tags, ["New"]);
    }
    assert.equal(model.tables.templateVersions.length, 3);
    assert.deepEqual(model.tables.templateVersions.map((version) => version.revision), [1, 1, 1]);
  });

  test("keeps one case-insensitive template-name namespace across targets in a project", async () => {
    model.tables.templates.push(
      template("1", "users:u", documentBody, { name: "Weekly Review" }),
      template("2", "users:u", slidesBody, { name: "Board", revision: 2 }),
      template("3", "users:x", documentBody, {
        projectId: "projects:other",
        name: "Other project only"
      })
    );

    assert.deepEqual(
      await createTemplate({ target: "presentation", name: "weekly review" }),
      {
        accepted: false,
        templateId: null,
        target: "presentation",
        reason: "name-in-use",
        detail: "a template named “weekly review” already exists in this project"
      }
    );
    assert.deepEqual(
      await updateTemplate({
        templateId: "templates:2",
        baseRevision: 2,
        patch: { name: "WEEKLY REVIEW" }
      }),
      {
        accepted: false,
        templateId: "templates:2",
        reason: "name-in-use",
        revision: 2,
        detail: "a template named “WEEKLY REVIEW” already exists in this project"
      }
    );
    assert.deepEqual(
      await duplicateTemplate({ templateId: "templates:2", name: "Weekly Review" }),
      {
        accepted: false,
        templateId: "templates:2",
        reason: "name-in-use",
        revision: 2,
        detail: "a template named “Weekly Review” already exists in this project"
      }
    );
    const allowed = await createTemplate({ target: "spreadsheet", name: "Other project only" });
    assert.equal(allowed.accepted, true);
    assert.equal(model.tables.templateVersions.length, 1);
  });

  test("numbers generated duplicate names instead of creating collisions", async () => {
    model.tables.templates.push(
      template("1", "users:u", slidesBody, { name: "Board" }),
      template("2", "users:u", slidesBody, { name: "Board copy" })
    );

    const answer = await duplicateTemplate({ templateId: "templates:1" });
    assert.equal(answer.accepted, true);
    if (!answer.accepted) return;
    const copy = model.tables.templates.find((candidate) => candidate._id === answer.templateId);
    assert.equal(copy?.name, "Board copy 2");
  });

  test("updates only this project's current revision and snapshots the accepted result", async () => {
    model.tables.templates.push(
      template("1", "users:u"),
      template("2", "users:v", documentBody, { projectId: "projects:other" })
    );

    assert.deepEqual(
      await updateTemplate({ templateId: "templates:1", baseRevision: 1, patch: { name: "Stale" } }),
      {
        accepted: false,
        templateId: "templates:1",
        reason: "stale",
        revision: 2,
        detail: "authored against revision 1, the template is at 2"
      }
    );
    assert.equal(
      (
        await updateTemplate({
          templateId: "templates:2",
          baseRevision: 2,
          patch: { name: "No" }
        })
      ).accepted,
      false
    );
    const accepted = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 2,
      patch: { name: "Renamed", description: "  Clearer  ", tags: ["One", "one", "Two"] }
    });
    assert.deepEqual(accepted, { accepted: true, templateId: "templates:1", revision: 3 });
    assert.deepEqual(model.tables.templates[0].tags, ["One", "Two"]);
    assert.equal(model.tables.templates[0].description, "Clearer");
    assert.equal(model.tables.templateVersions[0].revision, 3);
  });

  test("updates slot prose without exposing its stable key or default to editing", async () => {
    model.tables.templates.push(
      template("1", "users:u", documentBody, {
        slots: [
          {
            name: "evidence",
            label: "Evidence",
            kind: "scope",
            description: "Old help",
            default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] }
          }
        ]
      })
    );

    const answer = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 2,
      patch: {
        slotDescription: { name: "evidence", description: "  Choose the evidence set.  " }
      }
    });

    assert.deepEqual(answer, { accepted: true, templateId: "templates:1", revision: 3 });
    assert.deepEqual(model.tables.templates[0].slots, [
      {
        name: "evidence",
        label: "Evidence",
        kind: "scope",
        description: "Choose the evidence set.",
        default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] }
      }
    ]);
    assert.equal(model.tables.templateVersions.length, 1);
  });

  test("duplicates a visible template into a new viewer-owned template", async () => {
    model.tables.templates.push(template("1", "users:u", slidesBody, { description: "Source" }));

    const answer = await duplicateTemplate({ templateId: "templates:1", name: "My copy" });

    assert.equal(answer.accepted, true);
    const copy = model.tables.templates.find((candidate) => candidate._id === "templates:2");
    assert.equal(copy?.userId, "users:u");
    assert.equal(copy?.projectId, "projects:p");
    assert.equal(copy?.name, "My copy");
    assert.deepEqual(copy?.createdBy, { kind: "user", userId: "users:u" });
    assert.notEqual(copy?.body, model.tables.templates[0].body);
    assert.notEqual(copy?.slots, model.tables.templates[0].slots);
    assert.equal(model.tables.templateVersions.length, 1);
  });

  test("gives a duplicated private default its own live row and an inline version snapshot", async () => {
    const chosen = {
      include: [
        { select: "resources", refs: [{ kind: "document", id: "documents:1" }] }
      ],
      exclude: []
    };
    model.tables.templates.push(
      template("1", "users:u", documentBody, {
        slots: [
          {
            name: "evidence",
            label: "Evidence",
            kind: "scope",
            default: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
          }
        ]
      })
    );
    model.tables.resourceSets.push(
      row("resourceSets", "1", {
        projectId: "projects:p",
        boundTo: { kind: "slot", templateId: "templates:1", slot: "evidence" },
        set: chosen,
        createdBy: { kind: "user", userId: "users:u" },
        revision: 1,
        updatedAt: 20
      })
    );

    const answer = await duplicateTemplate({ templateId: "templates:1", name: "Independent" });
    assert.ok(answer.accepted);
    const copy = model.tables.templates.find((candidate) => candidate._id === answer.templateId);
    const copySet = model.tables.resourceSets.find(
      (candidate) =>
        (candidate.boundTo as { templateId?: string } | undefined)?.templateId === answer.templateId
    );
    assert.deepEqual(copy?.slots, [
      {
        name: "evidence",
        label: "Evidence",
        kind: "scope",
        default: { include: [{ select: "set", setId: copySet?._id }], exclude: [] }
      }
    ]);
    assert.deepEqual(copySet?.set, chosen);
    assert.deepEqual(model.tables.templateVersions[0].slots, [
      { name: "evidence", label: "Evidence", kind: "scope", default: chosen }
    ]);
  });

  test("throws before versioning, duplicating, or removing a malformed stored template", async () => {
    model.tables.templates.push(
      template("1", "users:u", { resource: "document", blocks: [] }, { name: "Malformed" })
    );

    await assert.rejects(() => updateTemplate({
      templateId: "templates:1",
      baseRevision: 2,
      patch: { name: "Still malformed" }
    }), /non-current field values/);
    await assert.rejects(
      () => duplicateTemplate({ templateId: "templates:1" }),
      /non-current field values/
    );
    await assert.rejects(
      () => removeTemplate({ templateId: "templates:1", baseRevision: 2 }),
      /non-current field values/
    );
    assert.equal(model.tables.templates.length, 1);
    assert.equal(model.tables.templateVersions.length, 0);
  });

  test("fails closed on a private scope row that omits its required revision", () => {
    const malformed = row("resourceSets", "1", {
      projectId: "projects:p",
      boundTo: { kind: "slot", templateId: "templates:1", slot: "evidence" },
      set: { include: [{ select: "project" }], exclude: [] },
      createdBy: { kind: "user", userId: "users:u" },
      updatedAt: 20
    });
    model.tables.resourceSets.push(malformed);

    assert.throws(
      () => normalizeScope(
        model.store as unknown as StoreUnitOfWork,
        "projects:p",
        { kind: "user", userId: "users:u" as never },
        { kind: "slot", templateId: "templates:1" as never, slot: "evidence" },
        {
          include: [{
            select: "resources",
            refs: [{ kind: "document", id: asId<"documents">("documents:1") }]
          }],
          exclude: []
        } satisfies ResourceSet,
        500
      ),
      /missing required field: revision/
    );

    assert.equal(malformed.revision, undefined);
    assert.equal(model.tables.resourceSets.length, 1);
  });

  test("requires an explicit prompt at both template admission and placement", () => {
    const missing = {
      resource: "document",
      rows: [{
        id: "row",
        kind: "blocks",
        blocks: [{
          id: "prompt",
          type: "prompt",
          atoms: [{ id: "prompt-atom", kind: "literal", text: "Summarize" }],
          display: "Summarize",
          marks: [],
          state: "idle"
        }]
      }]
    };

    assert.throws(() => bodyOf(missing, "missing-prompt"), /not a valid document template body/);
    assert.throws(
      () => withFreshOutputs(
        model.store as unknown as StoreUnitOfWork,
        "projects:p",
        { kind: "user", userId: "users:u" as never },
        { kind: "document", id: asId<"documents">("documents:1") },
        missing,
        500
      ),
      /prompt block 'prompt' requires an explicit prompt/
    );
    assert.equal((model.tables.derivedOutputs ?? []).length, 0);
  });

});

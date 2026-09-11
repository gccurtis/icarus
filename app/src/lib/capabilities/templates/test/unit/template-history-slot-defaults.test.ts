import assert from "node:assert/strict";
import { describe, test } from "vitest";
import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { RowFields } from "$capabilities/templates/api/shared/store";
import {
  body,
  model,
  updateTemplate,
  writeTemplateVersion
} from "$capabilities/templates/test/unit/template-answer-fixture";

describe("immutable slot defaults in template history", () => {
  const oneDocument = (id: string) => ({
    include: [{ select: "resources" as const, refs: [{ kind: "document" as const, id }] }],
    exclude: []
  });

  test("revision one keeps A after the live slot changes to B and is then removed", async () => {
    model.tables.templates = [];
    model.tables.templateVersions = [];
    model.tables.resourceSets = [];

    const a = oneDocument("documents:A");
    const b = oneDocument("documents:B");
    const base: RowFields<"templates"> = {
      projectId: "projects:1" as never,
      userId: "users:1" as never,
      name: "Evidence shell",
      tags: [],
      body: { resource: "document", rows: [] },
      slots: [],
      createdBy: { kind: "user", userId: "users:1" as never },
      revision: 1,
      updatedAt: 20
    };
    const templateId = model.store.create("templates", base) as never;
    const setId = model.store.create("resourceSets", {
      projectId: "projects:1",
      boundTo: { kind: "slot", templateId, slot: "evidence" },
      set: a,
      createdBy: { kind: "user", userId: "users:1" },
      revision: 1,
      updatedAt: 20
    });
    const revisionOne: RowFields<"templates"> = {
      ...base,
      slots: [
        {
          name: "evidence",
          label: "Evidence",
          kind: "scope",
          default: { include: [{ select: "set", setId: setId as never }], exclude: [] }
        }
      ]
    };
    model.store.update(`templates.${templateId}`, revisionOne);
    writeTemplateVersion(
      model.store as unknown as StoreUnitOfWork,
      templateId,
      revisionOne,
      20
    );

    const changed = await updateTemplate({
      templateId,
      baseRevision: 1,
      patch: {
        slots: [{ name: "evidence", label: "Evidence", kind: "scope", default: b }]
      }
    });
    assert.deepEqual(changed, { accepted: true, templateId, revision: 2 });
    assert.deepEqual(model.tables.templateVersions[0].slots, [
      { name: "evidence", label: "Evidence", kind: "scope", default: a }
    ]);
    assert.deepEqual(model.tables.templateVersions[1].slots, [
      { name: "evidence", label: "Evidence", kind: "scope", default: b }
    ]);

    const removed = await updateTemplate({
      templateId,
      baseRevision: 2,
      patch: { slots: [] }
    });
    assert.deepEqual(removed, { accepted: true, templateId, revision: 3 });
    assert.equal(model.tables.resourceSets.length, 0);
    assert.deepEqual(model.tables.templateVersions.map((version) => version.slots), [
      [{ name: "evidence", label: "Evidence", kind: "scope", default: a }],
      [{ name: "evidence", label: "Evidence", kind: "scope", default: b }],
      []
    ]);
  });
});

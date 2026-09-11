import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  body,
  instantiateTemplate,
  model,
  row,
  scopeOf,
  updateTemplate
} from "$capabilities/templates/test/unit/template-answer-fixture";

describe("a rule that cannot be said inline becomes a row", () => {
  const excluding = {
    include: [{ select: "project" }],
    exclude: [{ select: "kinds", kinds: ["presentation"] }]
  };

  test("a default that excludes something is stored, and the slot holds one term", async () => {
    const result = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 1,
      patch: { slots: [{ name: "evidence", label: "Evidence", kind: "scope", default: excluding }] }
    });
    assert.ok(result.accepted);

    const bound = model.tables.resourceSets.filter((set) => set.boundTo !== undefined);
    assert.equal(bound.length, 1);
    assert.deepEqual(bound[0].boundTo, {
      kind: "slot",
      templateId: "templates:1",
      slot: "evidence"
    });
    assert.equal(bound[0].name, undefined);
    assert.deepEqual(bound[0].set, excluding);
    assert.deepEqual(model.tables.templates[0].slots, [
      {
        name: "evidence",
        label: "Evidence",
        kind: "scope",
        default: { include: [{ select: "set", setId: bound[0]._id }], exclude: [] }
      }
    ]);
  });

  test("a rule that can be said inline writes nothing, and clears a row it had", async () => {
    await updateTemplate({
      templateId: "templates:1",
      baseRevision: 1,
      patch: { slots: [{ name: "evidence", label: "Evidence", kind: "scope", default: excluding }] }
    });
    const result = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 2,
      patch: {
        slots: [
          {
            name: "evidence",
            label: "Evidence",
            kind: "scope",
            default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] }
          }
        ]
      }
    });
    assert.ok(result.accepted);
    assert.equal(model.tables.resourceSets.filter((set) => set.boundTo !== undefined).length, 0);
  });

  test("the same slot rewrites its own row rather than piling them up", async () => {
    await updateTemplate({
      templateId: "templates:1",
      baseRevision: 1,
      patch: { slots: [{ name: "evidence", label: "Evidence", kind: "scope", default: excluding }] }
    });
    const first = model.tables.resourceSets.find((set) => set.boundTo !== undefined);
    await updateTemplate({
      templateId: "templates:1",
      baseRevision: 2,
      patch: {
        slots: [
          {
            name: "evidence",
            label: "Evidence",
            kind: "scope",
            default: {
              include: [{ select: "project" }],
              exclude: [{ select: "kinds", kinds: ["document"] }]
            }
          }
        ]
      }
    });
    const bound = model.tables.resourceSets.filter((set) => set.boundTo !== undefined);
    assert.equal(bound.length, 1);
    assert.equal(bound[0]._id, first?._id);
    assert.equal(bound[0].revision, 2);
  });

  test("a default may name particular resources, which a template cannot say itself", async () => {
    const result = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 1,
      patch: {
        slots: [
          {
            name: "evidence",
            label: "Evidence",
            kind: "scope",
            default: {
              include: [{ select: "resources", refs: [{ kind: "document", id: "documents:9" }] }],
              exclude: []
            }
          }
        ]
      }
    });
    assert.ok(result.accepted);
    const bound = model.tables.resourceSets.find((set) => set.boundTo !== undefined);
    assert.deepEqual(bound?.set, {
      include: [{ select: "resources", refs: [{ kind: "document", id: "documents:9" }] }],
      exclude: []
    });
  });

  test("an answer that excludes something resolves, because it became one term", async () => {
    const placed = await instantiateTemplate({
      templateId: "templates:1",
      answers: { evidence: excluding }
    });
    assert.ok(placed.accepted);
    const bound = model.tables.resourceSets.filter((set) => set.boundTo !== undefined);
    assert.equal(bound.length, 1);
    assert.deepEqual(bound[0].boundTo, {
      kind: "resource",
      ref: { kind: "document", id: placed.resourceId },
      slot: "evidence"
    });
    assert.deepEqual(scopeOf(model.tables.documentSnapshots[0]), {
      include: [{ select: "set", setId: bound[0]._id }],
      exclude: []
    });
  });

  test("a default naming a set from another project is refused", async () => {
    model.tables.resourceSets.push(
      row("resourceSets", "9", {
        projectId: "projects:other",
        name: "Elsewhere",
        set: { include: [], exclude: [] },
        createdBy: { kind: "user", userId: "users:1" },
        revision: 1,
        updatedAt: 1
      })
    );
    const result = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 1,
      patch: {
        slots: [
          {
            name: "evidence",
            label: "Evidence",
            kind: "scope",
            default: { include: [{ select: "set", setId: "resourceSets:9" }], exclude: [] }
          }
        ]
      }
    });
    assert.equal(result.accepted, false);
    assert.equal(result.accepted === false && result.reason, "unsupported-body");
  });

  test("a patch cannot borrow another owner's private resource set", async () => {
    model.tables.resourceSets.push(
      row("resourceSets", "9", {
        projectId: "projects:1",
        boundTo: {
          kind: "resource",
          ref: { kind: "document", id: "documents:9" },
          slot: "evidence"
        },
        set: {
          include: [{ select: "resources", refs: [{ kind: "document", id: "documents:9" }] }],
          exclude: []
        },
        createdBy: { kind: "user", userId: "users:1" },
        revision: 1,
        updatedAt: 1
      })
    );

    const before = structuredClone(model.tables.templates[0]);
    const result = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 1,
      patch: {
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
      }
    });

    assert.equal(result.accepted, false);
    assert.match(result.accepted === false ? result.detail : "", /private/);
    assert.deepEqual(model.tables.templates[0], before);
    assert.deepEqual(model.tables.templateVersions, []);
  });
});

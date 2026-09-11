import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  body,
  instantiateTemplate,
  model,
  prompt,
  row,
  scopeOf
} from "$capabilities/templates/test/unit/template-answer-fixture";

describe("instantiating with answers — ownership and declaration refusals", () => {
  test("a slot without a default means the whole project", async () => {
    model.tables.templates[0].slots = [{ name: "evidence", label: "Evidence", kind: "scope" }];
    const made = await instantiateTemplate({ templateId: "templates:1" });
    assert.ok(made.accepted);
    assert.deepEqual(scopeOf(model.tables.documentSnapshots[0]), {
      include: [{ select: "project" }],
      exclude: []
    });
  });

  test("a private default cannot transitively retain another owner's private row", async () => {
    model.tables.resourceSets.push(
      row("resourceSets", "2", {
        projectId: "projects:1",
        boundTo: { kind: "slot", templateId: "templates:1", slot: "evidence" },
        set: {
          include: [{ select: "set", setId: "resourceSets:3" }],
          exclude: []
        },
        createdBy: { kind: "user", userId: "users:1" },
        revision: 1,
        updatedAt: 1
      }),
      row("resourceSets", "3", {
        projectId: "projects:1",
        boundTo: {
          kind: "resource",
          ref: { kind: "document", id: "documents:3" },
          slot: "evidence"
        },
        set: { include: [{ select: "project" }], exclude: [] },
        createdBy: { kind: "user", userId: "users:1" },
        revision: 1,
        updatedAt: 1
      })
    );
    model.tables.templates[0].slots = [
      {
        name: "evidence",
        label: "Evidence",
        kind: "scope",
        default: { include: [{ select: "set", setId: "resourceSets:2" }], exclude: [] }
      }
    ];

    const result = await instantiateTemplate({ templateId: "templates:1" });

    assert.equal(result.accepted, false);
    assert.match(result.accepted === false ? result.detail : "", /resourceSets:3/);
    assert.deepEqual(model.tables.documents, []);
  });

  test("refuses an answer naming a set the project does not hold, and a body naming an undeclared slot", async () => {
    const unknownSet = await instantiateTemplate({
      templateId: "templates:1",
      answers: { evidence: { include: [{ select: "set", setId: "resourceSets:9" }], exclude: [] } }
    });
    assert.equal(unknownSet.accepted, false);
    assert.match(unknownSet.accepted === false ? unknownSet.detail : "", /resourceSets:9/);

    model.tables.resourceSets.push(
      row("resourceSets", "2", {
        projectId: "projects:1",
        boundTo: { kind: "slot", templateId: "templates:1", slot: "evidence" },
        set: { include: [{ select: "project" }], exclude: [] },
        createdBy: { kind: "user", userId: "users:1" },
        revision: 1,
        updatedAt: 1
      })
    );
    const privateSet = await instantiateTemplate({
      templateId: "templates:1",
      answers: {
        evidence: {
          include: [{ select: "set", setId: "resourceSets:2" }],
          exclude: []
        }
      }
    });
    assert.equal(privateSet.accepted, false);
    assert.match(privateSet.accepted === false ? privateSet.detail : "", /private/);
    assert.deepEqual(model.tables.documents, []);

    model.tables.templates[0].slots = [];
    const undeclared = await instantiateTemplate({ templateId: "templates:1" });
    assert.deepEqual(undeclared, {
      accepted: false,
      templateId: "templates:1",
      reason: "unsupported-body",
      revision: 1,
      detail: "the body names a slot the template does not declare: evidence"
    });
    assert.deepEqual(model.tables.documents, []);
    await assert.rejects(
      () => instantiateTemplate({ templateId: "templates:1", answers: { evidence: { kind: "set" } } }),
      /include list and an exclude list/
    );
  });
});

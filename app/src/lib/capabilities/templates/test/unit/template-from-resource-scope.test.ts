import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  body,
  createTemplateFromResource,
  linkedPrompt,
  model,
  prompt,
  row,
  scopeOf
} from "$capabilities/templates/test/unit/template-answer-fixture";

describe("a template from a live resource — scopes and presentations", () => {
  test("re-owns a linked prompt's private scope instead of retaining the source resource row", async () => {
    model.tables.documents.push(row("documents", "1", { projectId: "projects:1", title: "Winter brief" }));
    model.tables.resourceSets.push(
      row("resourceSets", "2", {
        projectId: "projects:1",
        boundTo: {
          kind: "resource",
          ref: { kind: "document", id: "documents:9" },
          slot: "winter"
        },
        set: {
          include: [
            { select: "resources", refs: [{ kind: "document", id: "documents:2" }] }
          ],
          exclude: []
        },
        createdBy: { kind: "user", userId: "users:1" },
        revision: 1,
        updatedAt: 1
      })
    );
    model.tables.derivedOutputs = [
      row("derivedOutputs", "3", {
        projectId: "projects:1",
        prompt: "What broke?",
        scope: { include: [{ select: "set", setId: "resourceSets:2" }], exclude: [] }
      })
    ];
    model.tables.documentSnapshots.push(
      row("documentSnapshots", "1", {
        projectId: "projects:1",
        resourceId: "documents:1",
        role: "leader",
        revision: 2,
        body: {
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
                  derivedOutputId: "derivedOutputs:3",
                  slot: { name: "winter" },
                  state: "idle"
                }
              ]
            }
          ]
        }
      })
    );

    const refused = await createTemplateFromResource({
      target: "document",
      resourceId: "documents:1",
      name: "Borrowed shell"
    });
    assert.equal(refused.accepted, false);
    assert.match(refused.accepted ? "" : refused.detail, /private/);
    assert.equal(model.tables.templates.length, 1);

    model.tables.resourceSets[1].boundTo = {
      kind: "resource",
      ref: { kind: "document", id: "documents:1" },
      slot: "winter"
    };
    const made = await createTemplateFromResource({
      target: "document",
      resourceId: "documents:1",
      name: "Winter shell"
    });
    assert.ok(made.accepted);
    const held = model.tables.templates[1];
    const defaultScope = (held.slots as { default: { include: { setId?: string }[] } }[])[0]
      .default;
    const setId = defaultScope.include[0].setId;
    assert.notEqual(setId, "resourceSets:2");
    const owned = model.tables.resourceSets.find((set) => set._id === setId);
    assert.deepEqual(owned?.boundTo, {
      kind: "slot",
      templateId: held._id,
      slot: "winter"
    });
    assert.deepEqual(owned?.set, model.tables.resourceSets.find((set) => set._id === "resourceSets:2")?.set);
    assert.deepEqual((model.tables.templateVersions[0].slots as { default: unknown }[])[0].default, owned?.set);

    model.store.update("resourceSets.resourceSets:2.set", {
      include: [{ select: "project" }],
      exclude: []
    });
    assert.deepEqual(owned?.set, {
      include: [
        { select: "resources", refs: [{ kind: "document", id: "documents:2" }] }
      ],
      exclude: []
    });
  });

  test("keeps whatever the templateified prompt reads as its slot's default", async () => {
    model.tables.documents.push(row("documents", "1", { projectId: "projects:1", title: "Winter brief" }));
    model.tables.documentSnapshots.push(
      row("documentSnapshots", "1", {
        projectId: "projects:1",
        resourceId: "documents:1",
        role: "leader",
        revision: 1,
        body: {
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
                  prompt: "Sum up",
                  marks: [],
                  slot: { name: "evidence", description: "What happened" },
                  scope: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] },
                  state: "idle"
                }
              ]
            }
          ]
        }
      })
    );

    const made = await createTemplateFromResource({
      target: "document",
      resourceId: "documents:1",
      name: "Named prompt"
    });
    assert.ok(made.accepted);
    const held = model.tables.templates[1];
    assert.deepEqual(held.slots, [
      {
        name: "evidence",
        label: "evidence",
        kind: "scope",
        description: "What happened",
        default: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
      }
    ]);
    assert.deepEqual(scopeOf(held), { include: [{ select: "slot", name: "evidence" }], exclude: [] });
  });

  test("makes a presentation template from the whole presentation or from one of its slides", async () => {
    model.tables.presentations.push(row("presentations", "1", { projectId: "projects:1", title: "Board" }));
    model.tables.presentationSnapshots.push(
      row("presentationSnapshots", "1", {
        projectId: "projects:1",
        resourceId: "presentations:1",
        role: "leader",
        revision: 1,
        body: {
          aspectRatio: "16:9",
          theme: { colors: { text: "ink", accent: "blue" } },
          styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
          layouts: [{ id: "l1", key: "title", name: "Title", locked: [], placeholders: [] }],
          slides: [
            { id: "s1", elements: [], notes: [] },
            { id: "s2", layoutKey: "title", elements: [], notes: [] }
          ],
          sections: [{ id: "sec", name: "One", firstSlideId: "s1" }]
        }
      })
    );

    const whole = await createTemplateFromResource({ target: "presentation", resourceId: "presentations:1", name: "Board" });
    assert.ok(whole.accepted);
    const wholeBody = model.tables.templates[1].body as { resource: string; slides: unknown[]; sections: unknown[] };
    assert.equal(wholeBody.resource, "presentation");
    assert.equal(wholeBody.slides.length, 2);
    assert.equal(wholeBody.sections.length, 1);

    const one = await createTemplateFromResource({
      target: "presentation",
      resourceId: "presentations:1",
      name: "Section divider",
      slideId: "s2"
    });
    assert.ok(one.accepted);
    const held = model.tables.templates[2].body as { resource: string; slides: { id: string }[]; layouts: unknown[]; sections: unknown[] };
    assert.equal(held.resource, "presentation");
    assert.deepEqual(held.slides.map((slide) => slide.id), ["s2"]);
    assert.equal(held.layouts.length, 1);
    assert.deepEqual(held.sections, []);

    const missing = await createTemplateFromResource({
      target: "presentation",
      resourceId: "presentations:1",
      name: "Nothing",
      slideId: "s9"
    });
    assert.equal(missing.accepted === false && missing.reason, "not-found");
    await assert.rejects(
      () => createTemplateFromResource({ target: "document", resourceId: "presentations:1", name: "x" }),
      /comes from a document/
    );
    await assert.rejects(
      () => createTemplateFromResource({ target: "document", resourceId: "documents:1", name: "x", slideId: "s1" }),
      /only a presentation template names a slide/
    );
  });
});

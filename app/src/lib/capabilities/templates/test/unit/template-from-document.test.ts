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

describe("a template from a live resource — documents", () => {
  test("makes a portable document template and declares the names its body uses", async () => {
    model.tables.documents.push(row("documents", "1", { projectId: "projects:1", title: "Winter brief" }));
    model.tables.derivedOutputs = [
      row("derivedOutputs", "3", {
        projectId: "projects:1",
        prompt: "Sum up",
        scope: { include: [{ select: "project" }], exclude: [] }
      })
    ];
    model.tables.documentSnapshots.push(
      row("documentSnapshots", "1", {
        projectId: "projects:1",
        resourceId: "documents:1",
        role: "leader",
        revision: 4,
        body: {
          rows: [
            {
              id: "r1",
              kind: "blocks",
              blocks: [
                linkedPrompt("p1", "evidence", "derivedOutputs:3"),
                {
                  id: "t1",
                  type: "text",
                  variant: "paragraph",
                  atoms: [{ id: "t1-a", kind: "literal", text: "Read the plan" }],
                  display: "Read the plan",
                  marks: [
                    {
                      id: "m1",
                      from: { atom: "t1-a", offset: 9 },
                      to: { atom: "t1-a", offset: 13 },
                      link: { kind: "url", url: "https://example.com/plan", note: "Scope" }
                    }
                  ]
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
      name: "Winter brief shell",
      tags: ["Winter"]
    });
    assert.deepEqual(made, {
      accepted: true,
      templateId: "templates:2",
      target: "document",
      revision: 1,
      dropped: ["Dropped a prompt's link to its generated output."]
    });
    const held = model.tables.templates[1];
    assert.equal(held.name, "Winter brief shell");
    assert.deepEqual(held.tags, ["Winter"]);
    assert.deepEqual(held.slots, [{
      name: "evidence",
      label: "evidence",
      kind: "scope",
      default: { include: [{ select: "project" }], exclude: [] }
    }]);
    const kept = (held.body as { rows: { blocks: { marks: { link: unknown }[] }[] }[] }).rows[0]
      .blocks[1].marks[0].link;
    assert.deepEqual(kept, { kind: "url", url: "https://example.com/plan", note: "Scope" });
    assert.equal("templateId" in model.tables.documents[0], false);
    assert.equal(model.tables.templateVersions.length, 1);
  });

  /**
   * Marking a run says where a slot goes. It does not put one there.
   *
   * The template gets the slot and the resource keeps its words, its
   * formatting and its display exactly as they were, which is the whole reason
   * a slot over text is a mark rather than an edit.
   */
  test("turns a marked run into a slot on the template and leaves the document alone", async () => {
    const live = {
      rows: [
        {
          id: "r1",
          kind: "blocks",
          blocks: [
            {
              id: "t1",
              type: "text",
              variant: "paragraph",
              atoms: [{ id: "t1-a", kind: "literal", text: "Dear Northwind, about winter." }],
              display: "Dear Northwind, about winter.",
              marks: [
                {
                  id: "m1",
                  from: { atom: "t1-a", offset: 5 },
                  to: { atom: "t1-a", offset: 14 },
                  slot: { name: "client", description: "Who it is for" }
                },
                { id: "m2", from: { atom: "t1-a", offset: 22 }, to: { atom: "t1-a", offset: 28 }, style: ["bold"] },
                { id: "m3", from: { atom: "t1-a", offset: 0 }, to: { atom: "t1-a", offset: 9 }, style: ["italic"] }
              ]
            }
          ]
        }
      ]
    };
    const untouched = structuredClone(live);
    model.tables.documents.push(row("documents", "1", { projectId: "projects:1", title: "Winter note" }));
    model.tables.documentSnapshots.push(
      row("documentSnapshots", "1", {
        projectId: "projects:1",
        resourceId: "documents:1",
        role: "leader",
        revision: 2,
        body: live
      })
    );

    const made = await createTemplateFromResource({
      target: "document",
      resourceId: "documents:1",
      name: "Winter note shell",
      tags: []
    });
    assert.equal(made.accepted, true);

    const held = model.tables.templates[1];
    assert.deepEqual(held.slots, [
      { name: "client", label: "client", kind: "text", description: "Who it is for", text: "Northwind" }
    ]);
    const block = (held.body as { rows: { blocks: Record<string, unknown>[] }[] }).rows[0].blocks[0];
    assert.equal(block.display, "Dear {client}, about winter.");
    assert.equal((block.marks as unknown[]).length, 1);
    assert.deepEqual((block.marks as { style: string[] }[])[0].style, ["bold"]);

    assert.deepEqual(model.tables.documentSnapshots[0].body, untouched);
  });

  /**
   * A slot is made, never found.
   *
   * A prompt nobody templateified keeps the scope it reads and produces no
   * slot, so placing the template asks nothing about it. That is what keeps
   * the questions to the ones somebody meant to ask.
   */
  test("gives no slot to a prompt nobody templateified", async () => {
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
                  scope: { include: [{ select: "project" }], exclude: [] },
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
      name: "Authored prompt"
    });
    assert.ok(made.accepted);
    const held = model.tables.templates[1];
    assert.deepEqual(held.slots, []);
    assert.deepEqual(scopeOf(held), { include: [{ select: "project" }], exclude: [] });
  });

  test("rejects a prompt that claims both inline and linked definition ownership", async () => {
    model.tables.documents.push(row("documents", "1", { projectId: "projects:1", title: "Winter brief" }));
    model.tables.derivedOutputs = [
      row("derivedOutputs", "3", {
        projectId: "projects:1",
        prompt: "What broke?",
        scope: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
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
                  prompt: "Sum up",
                  marks: [],
                  derivedOutputId: "derivedOutputs:3",
                  scope: { include: [{ select: "kinds", kinds: ["research"] }], exclude: [] },
                  slot: { name: "winter" },
                  state: "idle"
                }
              ]
            }
          ]
        }
      })
    );

    await assert.rejects(
      createTemplateFromResource({
        target: "document",
        resourceId: "documents:1",
        name: "Winter shell"
      }),
      /non-current field values/
    );
    assert.equal(model.tables.templates.length, 1);
  });

});

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

describe("instantiating with answers — resolution", () => {
  test("refuses answers that do not name a declared hole of the matching kind", async () => {
    const extraScope = await instantiateTemplate({
      templateId: "templates:1",
      answers: { missing: { include: [{ select: "project" }], exclude: [] } }
    });
    const textForScope = await instantiateTemplate({
      templateId: "templates:1",
      texts: { evidence: "Wrong kind" }
    });
    const extraText = await instantiateTemplate({
      templateId: "templates:1",
      texts: { missing: "No such hole" }
    });

    for (const refused of [extraScope, textForScope, extraText]) {
      assert.equal(refused.accepted, false);
      assert.match(refused.accepted ? "" : refused.detail, /do not match declared holes/);
    }
    assert.equal(model.tables.documents.length, 0);

    model.tables.templates[0].body = {
      resource: "document",
      rows: [
        {
          id: "row",
          kind: "blocks",
          blocks: [
            {
              id: "text",
              type: "text",
              variant: "paragraph",
              atoms: [{ id: "atom", kind: "template", name: "title" }],
              display: "{title}",
              marks: []
            }
          ]
        }
      ]
    };
    model.tables.templates[0].holes = [
      { name: "title", label: "Title", kind: "text", text: "Default" }
    ];
    const scopeForText = await instantiateTemplate({
      templateId: "templates:1",
      answers: { title: { include: [{ select: "project" }], exclude: [] } }
    });
    assert.equal(scopeForText.accepted, false);
    assert.match(scopeForText.accepted ? "" : scopeForText.detail, /do not match declared holes/);
    assert.equal(model.tables.documents.length, 0);
  });

  test("fills the scope from the caller, else the default", async () => {
    const byDefault = await instantiateTemplate({ templateId: "templates:1" });
    assert.ok(byDefault.accepted);
    assert.deepEqual(scopeOf(model.tables.documentSnapshots[0]), {
      include: [{ select: "kinds", kinds: ["finding"] }],
      exclude: []
    });

    const byCaller = await instantiateTemplate({
      templateId: "templates:1",
      answers: { evidence: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] } }
    });
    assert.ok(byCaller.accepted);
    assert.deepEqual(scopeOf(model.tables.documentSnapshots[1]), {
      include: [{ select: "set", setId: "resourceSets:1" }],
      exclude: []
    });
  });

  test("a default may name one of the project's sets", async () => {
    model.tables.templates[0].holes = [
      {
        name: "evidence",
        label: "Evidence",
        kind: "scope",
        default: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
      }
    ];
    const made = await instantiateTemplate({ templateId: "templates:1" });
    assert.equal(made.accepted, true);
    assert.deepEqual(scopeOf(model.tables.documentSnapshots[0]), {
      include: [{ select: "set", setId: "resourceSets:1" }],
      exclude: []
    });
  });

  test("placement fails closed on malformed and globally duplicated named Resource Sets", async () => {
    const reusable = structuredClone(model.tables.resourceSets[0]);
    const place = () => instantiateTemplate({
      templateId: "templates:1",
      answers: {
        evidence: {
          include: [{ select: "set", setId: "resourceSets:1" }],
          exclude: []
        }
      }
    });

    model.tables.resourceSets = [
      reusable,
      { ...reusable, projectId: "projects:other", name: "Foreign duplicate" }
    ];
    await assert.rejects(place, /repeats row id/);

    model.tables.resourceSets = [
      { ...reusable, set: { include: "everything", exclude: [] } }
    ];
    await assert.rejects(place, /non-current field values/);
    assert.deepEqual(model.tables.documents, []);
    assert.deepEqual(model.tables.documentSnapshots, []);
  });

  test("a stored default fails closed on a malformed or globally duplicated named set", async () => {
    model.tables.templates[0].holes = [
      {
        name: "evidence",
        label: "Evidence",
        kind: "scope",
        default: {
          include: [{ select: "set", setId: "resourceSets:1" }],
          exclude: []
        }
      }
    ];
    const reusable = structuredClone(model.tables.resourceSets[0]);

    model.tables.resourceSets = [
      reusable,
      { ...reusable, projectId: "projects:other", name: "Foreign duplicate" }
    ];
    await assert.rejects(
      () => instantiateTemplate({ templateId: "templates:1" }),
      /repeats row id/
    );

    model.tables.resourceSets = [
      { ...reusable, createdBy: { kind: "user" } }
    ];
    await assert.rejects(
      () => instantiateTemplate({ templateId: "templates:1" }),
      /non-current field values/
    );
    assert.deepEqual(model.tables.documents, []);
    assert.deepEqual(model.tables.documentSnapshots, []);
  });

  /**
   * A copy is the project's material from the moment it lands.
   *
   * Nothing else edits it, so without this the words are invisible to every
   * agent until somebody happens to type in it or a backfill is run by hand.
   */
  test("enqueues the copy for retrieval", async () => {
    const made = await instantiateTemplate({ templateId: "templates:1" });
    assert.ok(made.accepted);
    assert.deepEqual(
      (model.tables.semanticSyncJobs ?? []).map((row) => row.ref),
      [{ kind: "document", id: made.resourceId }]
    );
  });

  /**
   * A copy's prompts point back at the copy, in the vocabulary everything else
   * speaks. A deck is `slides` — the name the editors, the overlay and every
   * scope term already use.
   */
  test("gives a placed deck's prompts a derived output with a slides origin", async () => {
    model.tables.templates.push(
      row("templates", "2", {
        projectId: "projects:1",
        userId: "users:1",
        name: "Deck",
        tags: [],
        body: {
          resource: "slides",
          aspectRatio: "16:9",
          theme: { colors: { text: "ink", accent: "blue", muted: "gray" } },
          styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
          layouts: [],
          slides: [
            {
              id: "slide-1",
              elements: [
                {
                  id: "element-1",
                  frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
                  overflow: "shrink",
                  content: {
                    type: "prompt",
                    block: {
                      id: "deck-prompt",
                      type: "prompt",
                      atoms: [{ id: "deck-prompt-a", kind: "literal", text: "" }],
                      display: "",
                      marks: [],
                      state: "idle",
                      prompt: "What shipped this winter?"
                    }
                  }
                }
              ],
              notes: []
            }
          ],
          sections: []
        },
        holes: [],
        createdBy: { kind: "user", userId: "users:1" },
        revision: 1,
        updatedAt: 20
      })
    );

    const made = await instantiateTemplate({ templateId: "templates:2" });
    assert.ok(made.accepted);
    const outputs = model.tables.derivedOutputs ?? [];
    assert.equal(outputs.length, 1);
    assert.deepEqual(outputs[0].origin, { kind: "slides", id: made.resourceId });
    assert.equal(outputs[0].prompt, "What shipped this winter?");
  });

});

import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  documentBody,
  instantiateTemplate,
  model,
  row,
  slidesBody,
  spreadsheetBody,
  template
} from "$capabilities/templates/test/unit/template-fixture";

describe("instantiation — resource creation", () => {
  test("fails closed on corrupt stored metadata before creating any resource", async () => {
    model.tables.templates.push(
      template("1", "users:u", documentBody, { name: 42 }),
      template("2", "users:u", documentBody, { revision: 0 })
    );

    await assert.rejects(
      () => instantiateTemplate({ templateId: "templates:1" }),
      /non-current field values/
    );
    await assert.rejects(
      () => instantiateTemplate({ templateId: "templates:2" }),
      /non-current field values/
    );
    assert.equal(model.tables.documents.length, 0);
    assert.equal(model.tables.documentSnapshots.length, 0);
  });

  test("creates ordinary document and slide-deck rows with leader snapshots and no provenance", async () => {
    model.tables.templates.push(template("1", "users:u"), template("2", "users:u", slidesBody));

    const document = await instantiateTemplate({ templateId: "templates:1", name: "Brief" });
    const slides = await instantiateTemplate({ templateId: "templates:2" });

    assert.equal(document.accepted && document.target, "document");
    assert.equal(slides.accepted && slides.target, "slides");
    assert.equal("templateId" in model.tables.documents[0], false);
    assert.equal(model.tables.documentSnapshots[0].role, "leader");
    assert.equal("templateId" in model.tables.slideDecks[0], false);
    assert.equal(model.tables.slideDeckSnapshots[0].revision, 0);
    const readyDeck = model.tables.slideDeckSnapshots[0].body as { slides: { id: string }[] };
    assert.equal(readyDeck.slides.length, 1);
    assert.match(readyDeck.slides[0].id, /^slide-/);
    assert.equal(model.tables.templates[0].lastUsedAt, 500);
    assert.equal(model.tables.templates[0].revision, 2);
    assert.notEqual(model.tables.documents[0].createdBy, model.tables.documents[0].updatedBy);
    assert.notEqual(model.tables.slideDecks[0].createdBy, model.tables.slideDecks[0].updatedBy);
  });

  test("preserves current document pixel leading without schema inference", async () => {
    model.tables.templates.push(template("1", "users:u", {
      resource: "document",
      styles: {
        defaultKey: "body",
        styles: { body: { name: "Body", fontSize: 11, lineHeight: 16.5 } }
      },
      rows: []
    }));

    const answer = await instantiateTemplate({ templateId: "templates:1" });
    const snapshot = model.tables.documentSnapshots[0].body as {
      styles: { styles: { body: { lineHeight: number } } };
    };

    assert.equal(answer.accepted, true);
    assert.equal(snapshot.styles.styles.body.lineHeight, 16.5);
  });

  test("materializes a current spreadsheet template", async () => {
    model.tables.templates.push(template("1", "users:u", spreadsheetBody));

    const answer = await instantiateTemplate({ templateId: "templates:1" });

    assert.equal(answer.accepted, true);
    assert.equal(model.tables.spreadsheets.length, 1);
    assert.equal(model.tables.spreadsheetSnapshots.length, 1);
    assert.equal(model.tables.sheetCells.length, 2);
    assert.equal(model.tables.semanticMaterialJobs.length, 1);
  });

  test("does not invent a hole-answer contract", async () => {
    model.tables.templates.push(
      template(
        "1",
        "users:u",
        {
          resource: "document",
          rows: [
            {
              id: "row",
              kind: "blocks",
              blocks: [
                {
                  id: "prompt",
                  type: "prompt",
                  atoms: [],
                  display: "",
                  prompt: "Summarize",
                  marks: [],
                  scope: {
                    include: [{ select: "hole", name: "region" }],
                    exclude: []
                  },
                  state: "idle"
                }
              ]
            }
          ]
        },
        { holes: [{ name: "region", label: "Region", kind: "scope" }] }
      )
    );

    const answer = await instantiateTemplate({ templateId: "templates:1" });

    assert.equal(answer.accepted, true);
    const made = model.tables.documentSnapshots[0].body as {
      rows: { blocks: { derivedOutputId: string; prompt?: unknown; scope?: unknown }[] }[];
    };
    const block = made.rows[0].blocks[0];
    assert.equal("prompt" in block, false);
    assert.equal(block.scope, undefined);
    const output = model.tables.derivedOutputs.find((row) => row._id === block.derivedOutputId);
    assert.deepEqual(output?.scope, {
      include: [{ select: "project" }],
      exclude: []
    });
  });

  test("uses represented defaults without asking for an invented value shape", async () => {
    model.tables.templates.push(
      template(
        "1",
        "users:u",
        {
          resource: "document",
          rows: [
            {
              id: "row",
              kind: "blocks",
              blocks: [
                {
                  id: "prompt",
                  type: "prompt",
                  atoms: [],
                  display: "",
                  prompt: "Summarize",
                  marks: [],
                  scope: {
                    include: [{ select: "hole", name: "evidence" }],
                    exclude: []
                  },
                  state: "idle"
                },
                {
                  id: "prompt-again",
                  type: "prompt",
                  atoms: [],
                  display: "",
                  prompt: "Summarize",
                  marks: [],
                  scope: {
                    include: [{ select: "hole", name: "evidence" }],
                    exclude: []
                  },
                  state: "idle"
                }
              ]
            }
          ]
        },
        {
          holes: [
            {
              name: "evidence",
              label: "Evidence",
              kind: "scope",
              default: {
                include: [{ select: "kinds", kinds: ["finding", "document"] }],
                exclude: []
              }
            }
          ]
        }
      )
    );

    const answer = await instantiateTemplate({ templateId: "templates:1" });

    assert.equal(answer.accepted, true);
    const body = model.tables.documentSnapshots[0].body as {
      rows: { blocks: { derivedOutputId: string; scope?: unknown }[] }[];
    };
    const [firstBlock, secondBlock] = body.rows[0].blocks;
    assert.equal(firstBlock.scope, undefined);
    assert.equal(secondBlock.scope, undefined);
    const first = model.tables.derivedOutputs.find((row) => row._id === firstBlock.derivedOutputId)?.scope as {
      include: { kinds: string[] }[];
    };
    const second = model.tables.derivedOutputs.find((row) => row._id === secondBlock.derivedOutputId)?.scope as {
      include: { kinds: string[] }[];
    };
    assert.deepEqual(first, {
      include: [{ select: "kinds", kinds: ["finding", "document"] }],
      exclude: []
    });
    assert.deepEqual(second, first);
    assert.notEqual(second, first);
    assert.notEqual(first.include[0], second.include[0]);
    assert.notEqual(first.include[0].kinds, second.include[0].kinds);
  });

});

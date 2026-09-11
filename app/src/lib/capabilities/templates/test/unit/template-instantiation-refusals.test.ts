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

describe("instantiation — bounded exact input", () => {
  test("bounds recursively expanding represented defaults before writing", async () => {
    const slots = Array.from({ length: 16 }, (_, index) => ({
      name: `branch-${index}`,
      label: `Branch ${index}`,
      kind: "scope" as const,
      default:
        index === 15
          ? { include: [{ select: "project" as const }], exclude: [] }
          : {
              include: [
                { select: "slot" as const, name: `branch-${index + 1}` },
                { select: "slot" as const, name: `branch-${index + 1}` }
              ],
              exclude: []
            }
    }));
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
                    include: [{ select: "slot", name: "branch-0" }],
                    exclude: []
                  },
                  state: "idle"
                }
              ]
            }
          ]
        },
        { slots }
      )
    );

    const answer = await instantiateTemplate({ templateId: "templates:1" });

    assert.equal(answer.accepted, false);
    assert.equal(answer.accepted ? "" : answer.reason, "unsupported-body");
    assert.match(answer.accepted ? "" : answer.detail, /expand beyond 10000 terms/);
    assert.equal(model.tables.documents.length, 0);
  });

  test("refuses a slot-set difference rather than broadening its scope", async () => {
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
                    include: [{ select: "kinds", kinds: ["document"] }],
                    exclude: [{ select: "slot", name: "other-material" }]
                  },
                  state: "idle"
                }
              ]
            }
          ]
        },
        {
          slots: [
            {
              name: "other-material",
              label: "Other material",
              kind: "scope",
              default: {
                include: [{ select: "kinds", kinds: ["spreadsheet"] }],
                exclude: [{ select: "project" }]
              }
            }
          ]
        }
      )
    );

    const answer = await instantiateTemplate({ templateId: "templates:1" });

    assert.equal(answer.accepted, false);
    assert.equal(answer.accepted ? "" : answer.reason, "unsupported-body");
    assert.match(answer.accepted ? "" : answer.detail, /cannot be flattened/);
    assert.equal(model.tables.documents.length, 0);
  });

  test("refuses project-bound body ids and unbounded spreadsheet ranges before writing", async () => {
    model.tables.templates.push(
      template("1", "users:u", {
        resource: "document",
        rows: [
          {
            id: "row",
            kind: "blocks",
            blocks: [
              {
                id: "prompt",
                type: "prompt",
                derivedOutputId: "derivedOutputs:1",
                atoms: [],
                display: "",
                marks: [],
                state: "idle"
              }
            ]
          }
        ]
      }),
      template("2", "users:u", {
        ...spreadsheetBody,
        print: { ...spreadsheetBody.print, repeatRows: "1:999999999" }
      })
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
    assert.equal(model.tables.spreadsheets.length, 0);
  });

  test("fails closed on a malformed body an editor cannot open", async () => {
    model.tables.templates.push(template("1", "users:u", { resource: "document", blocks: [] }));

    await assert.rejects(
      () => instantiateTemplate({ templateId: "templates:1" }),
      /non-current field values/
    );
    assert.equal(model.tables.documents.length, 0);
  });
});

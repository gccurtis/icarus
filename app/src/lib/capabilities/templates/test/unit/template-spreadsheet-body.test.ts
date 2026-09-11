import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  bodyOf,
  changed,
  entries,
  fields,
  instantiateTemplate,
  model,
  row,
  spreadsheetBody,
  template
} from "$capabilities/templates/test/unit/template-fixture";

describe("stored template validation — spreadsheet bodies", () => {
  test("validates spreadsheet cell shapes, values, formats, and ordered bounded ranges", () => {
    assert.equal(bodyOf(spreadsheetBody, "test").resource, "spreadsheet");

    const malformed = [
      changed(spreadsheetBody, (draft) => {
        fields(fields(draft.cells).B2).invented = true;
      }),
      changed(spreadsheetBody, (draft) => {
        fields(fields(draft.cells).B2).value = { kind: "number", value: Number.NaN };
      }),
      changed(spreadsheetBody, (draft) => {
        fields(fields(draft.cells).B2).value = { kind: "number", value: 42, invented: true };
      }),
      changed(spreadsheetBody, (draft) => {
        fields(fields(draft.cells).B2).format = { invented: true };
      }),
      changed(spreadsheetBody, (draft) => {
        fields(fields(draft.cells).B2).merge = "A1";
      }),
      changed(spreadsheetBody, (draft) => {
        const cells = fields(draft.cells);
        cells.IW1 = {};
      }),
      changed(spreadsheetBody, (draft) => {
        const rule = fields(entries(draft.formatRules)[0]);
        rule.from = "B2";
        rule.to = "A1";
      }),
      changed(spreadsheetBody, (draft) => {
        const print = fields(draft.print);
        print.area = { from: "C8", to: "A1" };
      }),
      changed(spreadsheetBody, (draft) => {
        fields(draft.print).repeatRows = "2:1";
      }),
      changed(spreadsheetBody, (draft) => {
        fields(draft.print).invented = true;
      })
    ];
    for (const candidate of malformed) {
      assert.throws(
        () => bodyOf(candidate, "test"),
        /body is not a valid spreadsheet|exact current JSON data/
      );
    }
  });

  test("keeps body slot lookup exact when declarations differ only by case", async () => {
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
                    include: [{ select: "slot", name: "Region" }],
                    exclude: []
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
              name: "region",
              label: "Region",
              kind: "scope",
              default: { include: [{ select: "project" }], exclude: [] }
            }
          ]
        }
      )
    );

    const answer = await instantiateTemplate({ templateId: "templates:1" });

    assert.equal(answer.accepted, false);
    assert.equal(answer.accepted ? "" : answer.reason, "unsupported-body");
    assert.match(answer.accepted ? "" : answer.detail, /does not declare: Region/);
  });
});

import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  bodyOf,
  changed,
  entries,
  fields,
  row
} from "$capabilities/templates/test/unit/template-fixture";

describe("stored template validation — document bodies", () => {
  test("validates document furniture, page metrics, proportions, displays, and global ids", () => {
    const body = {
      resource: "document",
      pageSetup: {
        paper: "letter",
        orientation: "portrait",
        margins: { top: 0.75, right: 0.75, bottom: 0.75, left: 0.75 }
      },
      styles: {
        defaultKey: "body",
        styles: { body: { name: "Body", fontSize: 11 } }
      },
      rows: [
        {
          id: "body-row",
          kind: "blocks",
          blocks: [
            {
              id: "body-block",
              type: "text",
              variant: "paragraph",
              atoms: [{ id: "body-atom", kind: "literal", text: "Body" }],
              display: "Body",
              marks: [
                {
                  id: "body-mark",
                  from: { atom: "body-atom", offset: 0 },
                  to: { atom: "body-atom", offset: 4 },
                  style: ["bold"]
                }
              ]
            }
          ],
          proportions: [1]
        }
      ],
      header: {
        rows: [
          {
            id: "header-row",
            kind: "blocks",
            blocks: [
              {
                id: "header-block",
                type: "text",
                variant: "paragraph",
                atoms: [{ id: "header-atom", kind: "literal", text: "Header" }],
                display: "Header",
                marks: []
              }
            ]
          }
        ],
        firstPageRows: [{ id: "first-page-divider", kind: "divider", width: 1 }],
        distanceFromEdge: 0.25,
        pageNumber: { position: "end", format: "Page {page}", startAt: 1 }
      },
      footer: {
        rows: [{ id: "footer-divider", kind: "divider", style: "solid" }],
        distanceFromEdge: 0.25
      }
    };
    assert.equal(bodyOf(body, "test").resource, "document");

    const malformed = [
      { ...body, invented: true },
      changed(body, (draft) => {
        const page = fields(draft.pageSetup);
        page.invented = true;
      }),
      changed(body, (draft) => {
        const margins = fields(fields(draft.pageSetup).margins);
        margins.left = 4.5;
        margins.right = 4.5;
      }),
      changed(body, (draft) => {
        const styles = fields(fields(draft.styles).styles);
        fields(styles.body).fontSize = Number.NaN;
      }),
      changed(body, (draft) => {
        fields(draft.header).invented = true;
      }),
      changed(body, (draft) => {
        fields(entries(draft.rows)[0]).proportions = [];
      }),
      changed(body, (draft) => {
        fields(entries(fields(entries(draft.rows)[0]).blocks)[0]).display = "Not body";
      }),
      changed(body, (draft) => {
        const block = fields(entries(fields(entries(draft.rows)[0]).blocks)[0]);
        fields(fields(entries(block.marks)[0]).to).atom = "missing-atom";
      }),
      changed(body, (draft) => {
        const header = fields(draft.header);
        const headerRow = fields(entries(header.rows)[0]);
        const headerBlock = fields(entries(headerRow.blocks)[0]);
        headerBlock.id = "body-block";
      }),
      changed(body, (draft) => {
        const header = fields(draft.header);
        const headerRow = fields(entries(header.rows)[0]);
        const headerBlock = fields(entries(headerRow.blocks)[0]);
        fields(entries(headerBlock.atoms)[0]).id = "body-atom";
      })
    ];
    for (const candidate of malformed) {
      assert.throws(
        () => bodyOf(candidate, "test"),
        /body is not a valid document|exact current JSON data/
      );
    }
  });

});

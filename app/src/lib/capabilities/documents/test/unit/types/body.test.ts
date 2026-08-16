import { describe, expect, it } from "vitest";
import { validate } from "convex-helpers/validators";
import { documentBodyValidator, documentRowValidator, emptyDocumentBody } from "$documents/types/body";

const page = {
  paper: "a4",
  orientation: "portrait",
  margins: { top: 72, right: 72, bottom: 72, left: 72 }
};

const styles = { styles: { body: { name: "Body" } }, defaultKey: "body" };

const paragraph = {
  id: "b7x2",
  type: "text",
  variant: "paragraph",
  atoms: [{ id: "a9x1", kind: "literal", text: "Hello" }],
  display: "Hello",
  marks: []
};

describe("documentBodyValidator", () => {
  it("holds the page and the styles, so restyling is an edit and an undo reaches it", () => {
    expect(Object.keys(documentBodyValidator.fields).sort()).toEqual([
      "footer",
      "header",
      "page",
      "rows",
      "styles"
    ]);
    expect(validate(documentBodyValidator, { page, styles, rows: [] })).toBe(true);
    expect(validate(documentBodyValidator, { styles, rows: [] })).toBe(false);
  });

  it("carries no title and no timestamps — those are the row's and are not versioned", () => {
    expect(documentBodyValidator.fields).not.toHaveProperty("title");
    expect(documentBodyValidator.fields).not.toHaveProperty("updatedAt");
  });

  it("positions furniture from the page edge, because it sits outside the margins", () => {
    const header = { rows: [{ id: "r1", kind: "blocks", blocks: [paragraph] }], distanceFromEdge: 36 };
    expect(validate(documentBodyValidator, { page, styles, rows: [], header })).toBe(true);
    const { distanceFromEdge: _distance, ...unplaced } = header;
    expect(validate(documentBodyValidator, { page, styles, rows: [], header: unplaced })).toBe(false);
  });
});

describe("documentRowValidator", () => {
  it("is the three things that occupy a full width, and no empty kind", () => {
    expect(documentRowValidator.members.map((member) => member.fields.kind.value).sort()).toEqual([
      "blocks",
      "divider",
      "pageBreak"
    ]);
  });

  it("gives every row an id, which is what an insert above it does not disturb", () => {
    for (const member of documentRowValidator.members) {
      expect(member.fields.id.kind).toBe("string");
    }
  });

  it("proportions a row relatively, so it survives a change of paper", () => {
    const row = { id: "r1", kind: "blocks", blocks: [paragraph, paragraph], proportions: [2, 1] };
    expect(validate(documentRowValidator, row)).toBe(true);
    expect(validate(documentRowValidator, { ...row, proportions: ["66%", "33%"] })).toBe(false);
  });
});

describe("emptyDocumentBody", () => {
  it("is a page with nothing on it, and is a body the schema admits", () => {
    const body = emptyDocumentBody();
    expect(body.rows).toEqual([]);
    expect(validate(documentBodyValidator, body)).toBe(true);
  });

  it("names the style unstyled text uses, because a default is not optional", () => {
    const body = emptyDocumentBody();
    expect(body.styles.styles).toHaveProperty(body.styles.defaultKey);
  });
});

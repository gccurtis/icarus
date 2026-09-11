import { describe, expect, it } from "vitest";

import {
  defaultStyleEdit,
  deleteStyleEdit,
  duplicateStyleEdit,
  newStyleEdit,
  styleFieldEdit,
  styleOptions,
  styleSummary
} from "$app-views/categories/presentation-editor/procedures/styles";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { PresentationBody } from "$representation/data/types/presentations/body";

const text = (id: string, style?: string): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  ...(style === undefined ? {} : { style }),
  atoms: [{ id: `${id}-atom`, kind: "literal", text: id }],
  display: id,
  marks: []
});

const body = (): PresentationBody => ({
  aspectRatio: "16:9",
  theme: {
    colors: { text: "--token-ink-primary", accent: "--token-color-accent-1-fill" },
    fontFamily: "IBM Plex Sans"
  },
  styles: {
    defaultKey: "body",
    styles: {
      body: { name: "Body", fontSize: 20 },
      caption: { name: "Caption", fontSize: 14, italic: true }
    }
  },
  layouts: [],
  sections: [],
  slides: [
    {
      id: "slide-1",
      notes: [text("notes", "caption")],
      elements: [
        {
          id: "text-element",
          frame: { x: 0, y: 0, width: 0.5, height: 0.2 },
          content: { type: "text", block: text("text-block", "caption") }
        },
        {
          id: "table-element",
          frame: { x: 0, y: 0.3, width: 0.5, height: 0.2 },
          content: {
            type: "table",
            block: {
              id: "table-block",
              type: "table",
              headerRows: 0,
              rows: [
                {
                  id: "row-1",
                  cells: [{ id: "cell-1", blocks: [text("cell-text", "caption")] }]
                }
              ]
            }
          }
        }
      ]
    }
  ]
});

describe("presentation named styles", () => {
  it("projects the list and a concise visual summary", () => {
    const presentation = body();
    expect(styleOptions(presentation)).toEqual([
      { value: "body", label: "Body" },
      { value: "caption", label: "Caption" }
    ]);
    expect(styleSummary(presentation.styles.styles.caption)).toBe("IBM Plex Sans 14/1.3 · italic");
  });

  it("edits fields idempotently and can change the default", () => {
    const presentation = body();
    expect(styleFieldEdit(presentation, "caption", "fontSize", 14).ops).toEqual([]);

    const resized = styleFieldEdit(presentation, "caption", "fontSize", 16);
    expect(resized.body.styles.styles.caption.fontSize).toBe(16);
    expect(defaultStyleEdit(resized.body, "caption").body.styles.defaultKey).toBe("caption");
    expect(defaultStyleEdit(presentation, "missing").ops).toEqual([]);
  });

  it("creates and duplicates collision-free styles from represented values", () => {
    const presentation = body();
    const made = newStyleEdit(presentation);
    expect(made.key).toBe("new-style");
    expect(made.edit.body.styles.styles[made.key]).toMatchObject({ name: "New style", fontSize: 20 });

    const copied = duplicateStyleEdit(made.edit.body, made.key);
    expect(copied.key).toBe("new-style-copy");
    expect(copied.edit.body.styles.styles[copied.key!].name).toBe("New style copy");
  });

  it("reassigns every explicit text reference before deleting a non-default style", () => {
    const edit = deleteStyleEdit(body(), "caption");
    expect(edit.body.styles.styles.caption).toBeUndefined();
    expect(edit.body.slides[0].notes[0]).toMatchObject({ style: "body" });

    const textContent = edit.body.slides[0].elements[0].content;
    if (textContent.type !== "text") throw new Error("expected text");
    expect(textContent.block.style).toBe("body");

    const tableContent = edit.body.slides[0].elements[1].content;
    if (tableContent.type !== "table") throw new Error("expected table");
    expect(tableContent.block.rows[0].cells[0].blocks[0]).toMatchObject({ style: "body" });
    expect(deleteStyleEdit(body(), "body").ops).toEqual([]);
  });
});

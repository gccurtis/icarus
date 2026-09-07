import { describe, expect, it } from "vitest";
import { normalizeSlideDeckBody } from "$representation/data/behavior/slide-decks/normalize";

const text = (
  id: string,
  display: string,
  marks: readonly Record<string, unknown>[] = []
) => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}-atom`, kind: "literal", text: display }],
  display,
  marks
});

const legacy = {
  aspectRatio: "16:9",
  theme: { colors: { text: "ink", accent: "blue" } },
  styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
  layouts: [
    {
      key: "title",
      name: "Title",
      locked: [],
      placeholders: []
    }
  ],
  slides: [
    {
      id: "slide-1",
      elements: [
        {
          id: "multi-content-1",
          frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
          blocks: [
            text("title-block", "A title", [
              { id: "legacy-mark", from: 2, to: 7, style: ["bold"] }
            ])
          ],
          overflow: "shrink",
          format: {
            background: "paper",
            border: { color: "rule", width: 2, style: "dashed" },
            padding: { x: 18, y: 12 }
          }
        },
        {
          id: "multi",
          frame: { x: 0.1, y: 0.35, width: 0.8, height: 0.5 },
          blocks: [
            text("body-block", "The evidence"),
            {
              id: "prompt-block",
              type: "prompt",
              atoms: [{ id: "prompt-atom", kind: "literal", text: "Summarize it" }],
              display: "Summarize it",
              marks: [],
              scope: { include: [{ select: "project" }], exclude: [] },
              state: "idle"
            }
          ],
          overflow: "clip",
          format: {
            background: "wash",
            border: { color: "rule", width: 1, style: "solid" },
            padding: { x: 20, y: 16 },
            color: "ink"
          }
        }
      ],
      notes: []
    }
  ],
  sections: []
};

describe("normalizeSlideDeckBody", () => {
  it("converts old element containers without dropping blocks or decoration", () => {
    const body = normalizeSlideDeckBody(legacy);
    const title = body.slides[0].elements[0];
    const group = body.slides[0].elements[1];

    expect(body.layouts[0].id).toBe("layout-title");
    expect(title.content.type).toBe("text");
    expect(title.paint).toEqual({
      fill: "paper",
      stroke: { color: "rule", width: 2, dash: "dashed" }
    });
    if (title.content.type !== "text") throw new Error("expected normalized text content");
    expect(title.content.block.format?.padding).toEqual({ x: 18, y: 12 });
    expect(title.content.block.marks[0]).toMatchObject({
      from: { atom: "title-block-atom", offset: 2 },
      to: { atom: "title-block-atom", offset: 7 }
    });

    expect(group.content.type).toBe("group");
    if (group.content.type !== "group") throw new Error("expected normalized group content");
    expect(group.content.children.map((child) => child.content.type)).toEqual([
      "shape",
      "text",
      "prompt"
    ]);
    expect(group.content.children[0].paint).toEqual({
      fill: "wash",
      stroke: { color: "rule", width: 1, dash: "solid" }
    });
    expect(group.content.children[0].locked).toBe(true);
    expect(group.content.children[1].id).toBe("multi-content-1-2");
    expect(group.content.children[1].frame.height).toBeGreaterThan(0);

    const prompt = group.content.children[2].content;
    if (prompt.type !== "prompt") throw new Error("expected normalized prompt content");
    expect(prompt.block.scope).toEqual({ include: [{ select: "project" }], exclude: [] });
    expect(prompt.block.format?.color).toBe("ink");
    expect(prompt.block.format?.padding).toBeUndefined();
  });

  it("is deterministic and idempotent", () => {
    const first = normalizeSlideDeckBody(legacy);

    expect(normalizeSlideDeckBody(legacy)).toEqual(first);
    expect(normalizeSlideDeckBody(first)).toEqual(first);
  });

  it("gives an existing shape an editable empty text block", () => {
    const body = normalizeSlideDeckBody({
      aspectRatio: "16:9",
      theme: { colors: { text: "ink", accent: "accent" } },
      styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
      layouts: [],
      sections: [],
      slides: [
        {
          id: "slide",
          notes: [],
          elements: [
            {
              id: "shape",
              frame: { x: 0.2, y: 0.2, width: 0.3, height: 0.3 },
              content: { type: "shape", shape: "rectangle" }
            }
          ]
        }
      ]
    });

    const content = body.slides[0].elements[0].content;
    if (content.type !== "shape") throw new Error("expected a shape");
    expect(content.block).toMatchObject({
      id: "shape-text",
      type: "text",
      display: "",
      marks: []
    });
    expect(normalizeSlideDeckBody(body)).toEqual(body);
  });
});

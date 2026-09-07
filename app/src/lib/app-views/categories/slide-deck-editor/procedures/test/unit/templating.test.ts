import { describe, expect, it } from "vitest";

import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { TemplateDetail } from "$capabilities/templates/index.remote";
import {
  deckTemplatesIn,
  insertionOf
} from "$app-views/categories/slide-deck-editor/procedures/templating";

const text = (id: string, display: string) => ({
  id,
  type: "text" as const,
  variant: "paragraph" as const,
  atoms: [{ id: `${id}-a`, kind: "literal" as const, text: display }],
  display,
  marks: []
});

const deck: SlideDeckBody = {
  aspectRatio: "16:9",
  theme: { colors: { text: "ink", accent: "blue" } },
  styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
  layouts: [{ id: "l-title", key: "title", name: "Title", locked: [], placeholders: [] }],
  slides: [
    { id: "s1", layoutKey: "title", elements: [], notes: [] },
    { id: "s2", elements: [], notes: [] }
  ],
  sections: []
};

const template = (slides: 1 | 2): TemplateDetail => ({
  id: "templates:5",
  name: "Board review",
  target: "slides",
  availability: "personal",
  tags: [],
  createdByName: "Uma",
  revision: 1,
  updatedAt: 1,
  lastUsedAt: null,
  canEdit: true,
  canDelete: true,
  body: {
    resource: "slides",
    aspectRatio: "16:9",
    theme: { colors: { text: "ink", accent: "red" } },
    styles: { defaultKey: "body", styles: { body: { name: "Body", fontSize: 20 }, caption: { name: "Caption" } } },
    layouts: [
      { id: "tl-title", key: "title", name: "Title (template)", locked: [], placeholders: [] },
      { id: "tl-brief", key: "brief", name: "Brief", locked: [], placeholders: [] }
    ],
    slides: [
      {
        id: "ts1",
        layoutKey: "brief",
        elements: [
          {
            id: "te1",
            frame: { x: 0.1, y: 0.1, width: 0.5, height: 0.2 },
            content: {
              type: "prompt",
              block: {
                id: "tp1",
                type: "prompt",
                atoms: [{ id: "tp1-a", kind: "literal", text: "Sum up" }],
                display: "Sum up",
                marks: [],
                scope: { include: [{ select: "variable", name: "evidence" }], exclude: [] },
                state: "idle"
              }
            }
          }
        ],
        notes: [text("tn1", "Say this")]
      },
      ...(slides === 2 ? [{ id: "ts2", layoutKey: "title", elements: [], notes: [] }] : [])
    ],
    sections: []
  },
  variables: [{ name: "evidence", label: "Evidence", default: { include: [{ select: "project" }], exclude: [] } }]
});

describe("inserting a template into a deck", () => {
  it("appends the slides after the current one with fresh ids, and brings what the deck lacks", () => {
    const insertion = insertionOf(deck, template(2), "s1", "resolve");
    const after = insertion.body;
    expect(after.slides.map((slide) => slide.id).slice(0, 1)).toEqual(["s1"]);
    expect(after.slides.length).toBe(4);
    expect(after.slides[1].id).toBe(insertion.firstSlideId);
    expect(after.slides[1].id.startsWith("slide-")).toBe(true);
    expect(after.slides[3].id).toBe("s2");
    expect(after.layouts.map((layout) => layout.key)).toEqual(["title", "brief"]);
    expect(after.layouts[0].name).toBe("Title");
    expect(after.slides[2].layoutKey).toBe("title");
    expect(Object.keys(after.styles.styles)).toEqual(["body", "caption"]);
    expect(after.styles.styles.body).toEqual({ name: "Body" });
    const element = after.slides[1].elements[0];
    expect(element.id.startsWith("el-")).toBe(true);
    if (element.content.type !== "prompt") throw new Error("prompt expected");
    expect(element.content.block.scope).toEqual({ include: [{ select: "project" }], exclude: [] });
    expect(after.slides[1].notes[0].id.startsWith("blk-")).toBe(true);
  });

  it("puts a one-slide template in, keeping variable terms for a stage", () => {
    const insertion = insertionOf(deck, template(1), "s2", "keep");
    expect(insertion.body.slides.length).toBe(3);
    expect(insertion.body.slides[2].id).toBe(insertion.firstSlideId);
    const element = insertion.body.slides[2].elements[0];
    if (element.content.type !== "prompt") throw new Error("prompt expected");
    expect(element.content.block.scope).toEqual({ include: [{ select: "variable", name: "evidence" }], exclude: [] });
  });

  it("falls back to the end when the anchor is not in the deck, and does nothing for a document", () => {
    const insertion = insertionOf(deck, template(1), "gone", "resolve");
    expect(insertion.body.slides[2].id).toBe(insertion.firstSlideId);
    const nothing = insertionOf(deck, { ...template(1), body: { resource: "document", rows: [] } }, null, "resolve");
    expect(nothing.ops).toEqual([]);
  });

  it("lists only deck templates", () => {
    const library = {
      templates: [
        { ...template(2), id: "a", variableCount: 1 },
        { ...template(1), id: "b", target: "document" as const, variableCount: 1 }
      ],
      unavailable: []
    };
    expect(deckTemplatesIn(library).map((item) => item.id)).toEqual(["a"]);
  });
});

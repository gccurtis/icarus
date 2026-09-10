import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  bodyOf,
  changed,
  entries,
  fields,
  template
} from "$capabilities/templates/test/unit/template-fixture";

describe("stored template validation — slide bodies", () => {
  test("validates current slide layouts, content, references, frames, and deck ids", () => {
    const body = {
      resource: "slides",
      aspectRatio: "16:9",
      theme: { colors: { text: "ink", accent: "blue", muted: "muted" } },
      styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
      layouts: [
        {
          id: "layout-title",
          key: "title",
          name: "Title",
          locked: [],
          placeholders: [
            {
              role: "title",
              frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
              styleKey: "body"
            }
          ]
        }
      ],
      slides: [
        {
          id: "slide-1",
          layoutKey: "title",
          elements: [
            {
              id: "element-1",
              frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
              overflow: "shrink",
              fromPlaceholder: "title",
              content: {
                type: "text",
                block: {
                  id: "slide-block",
                  type: "text",
                  variant: "heading",
                  atoms: [{ id: "slide-atom", kind: "literal", text: "Title" }],
                  display: "Title",
                  marks: []
                }
              }
            }
          ],
          notes: [
            {
              id: "notes-block",
              type: "text",
              variant: "paragraph",
              atoms: [{ id: "notes-atom", kind: "literal", text: "Notes" }],
              display: "Notes",
              marks: []
            }
          ]
        }
      ],
      sections: [{ id: "section-1", name: "Opening", firstSlideId: "slide-1" }]
    };
    const current = bodyOf(body, "test");
    assert.equal(current.resource, "slides");
    if (current.resource !== "slides") throw new Error("expected a slide template");
    assert.equal(current.layouts[0].id, "layout-title");
    assert.equal(current.slides[0].elements[0].content.type, "text");
    assert.doesNotThrow(() => bodyOf(current, "current"));

    const compound = bodyOf(
      changed(body, (draft) => {
        const slide = fields(entries(draft.slides)[0]);
        const element = fields(entries(slide.elements)[0]);
        element.content = {
          type: "group",
          children: [
            {
              id: "background-element",
              frame: { x: 0, y: 0, width: 1, height: 1 },
              paint: { fill: "paper", stroke: { color: "rule", width: 1, dash: "solid" } },
              locked: true,
              content: { type: "shape", shape: "rectangle" }
            },
            {
              id: "text-element",
              frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.35 },
              content: {
                type: "text",
                block: {
                  id: "group-text-block",
                  type: "text",
                  variant: "paragraph",
                  atoms: [{ id: "group-text-atom", kind: "literal", text: "Evidence" }],
                  display: "Evidence",
                  marks: []
                }
              }
            },
            {
              id: "prompt-element",
              frame: { x: 0.1, y: 0.55, width: 0.8, height: 0.35 },
              content: {
                type: "prompt",
                block: {
                  id: "prompt-block",
                  type: "prompt",
                  atoms: [{ id: "prompt-atom", kind: "literal", text: "Summarize" }],
                  display: "Summarize",
                  prompt: "Summarize",
                  marks: [],
                  scope: { include: [{ select: "project" }], exclude: [] },
                  state: "idle"
                }
              }
            }
          ]
        };
      }),
      "compound"
    );
    if (compound.resource !== "slides") throw new Error("expected a slide template");
    const compoundContent = compound.slides[0].elements[0].content;
    assert.equal(compoundContent.type, "group");
    if (compoundContent.type !== "group") throw new Error("expected grouped content");
    assert.deepEqual(
      compoundContent.children.map((child) => child.content.type),
      ["shape", "text", "prompt"]
    );
    assert.equal(
      bodyOf(
        changed(body, (draft) => {
          const slide = fields(entries(draft.slides)[0]);
          const element = fields(entries(slide.elements)[0]);
          fields(element.frame).x = 0.9;
          fields(element.frame).width = 0.4;
        }),
        "test"
      ).resource,
      "slides"
    );

    const malformed = [
      changed(body, (draft) => {
        fields(entries(draft.layouts)[0]).invented = true;
      }),
      changed(body, (draft) => {
        const layout = fields(entries(draft.layouts)[0]);
        fields(entries(layout.placeholders)[0]).styleKey = "missing";
      }),
      changed(body, (draft) => {
        const slide = fields(entries(draft.slides)[0]);
        fields(entries(slide.elements)[0]).overflow = "visible";
      }),
      changed(body, (draft) => {
        fields(entries(draft.slides)[0]).layoutKey = "missing";
      }),
      changed(body, (draft) => {
        const slide = fields(entries(draft.slides)[0]);
        fields(entries(slide.elements)[0]).fromPlaceholder = "missing";
      }),
      changed(body, (draft) => {
        fields(entries(draft.sections)[0]).firstSlideId = "missing";
      }),
      changed(body, (draft) => {
        const slide = fields(entries(draft.slides)[0]);
        const element = fields(entries(slide.elements)[0]);
        fields(element.frame).width = Number.POSITIVE_INFINITY;
      }),
      changed(body, (draft) => {
        const slide = fields(entries(draft.slides)[0]);
        const notes = fields(entries(slide.notes)[0]);
        notes.id = "slide-block";
      }),
      changed(current, (draft) => {
        const slide = fields(entries(draft.slides)[0]);
        const element = fields(entries(slide.elements)[0]);
        fields(element.content).invented = true;
      }),
      changed(current, (draft) => {
        fields(entries(draft.layouts)[0]).id = "";
      }),
      changed(current, (draft) => {
        const slide = fields(entries(draft.slides)[0]);
        const element = fields(entries(slide.elements)[0]);
        const content = fields(element.content);
        element.blocks = [content.block];
        delete element.content;
      })
    ];
    for (const candidate of malformed) {
      assert.throws(
        () => bodyOf(candidate, "test"),
        /body is not a valid slides|exact current JSON data/
      );
    }
  });

});

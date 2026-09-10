import { describe, expect, it } from "vitest";
import { asId } from "$representation/data/behavior/core/id";
import { projectResource } from "$representation/data/behavior/semantic/projection/project-resource";
import type { TextBlock } from "$representation/data/types/content/content-block";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";

const text = (id: string, display: string): TextBlock => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}:atom`, kind: "literal", text: display }],
  display,
  marks: []
});

describe("semantic resource text projection", () => {
  it("flattens document content while retaining exact block locators", () => {
    const projection = projectResource({
      kind: "document",
      ref: { kind: "document", id: asId<"documents">("documents:people") },
      revision: 7,
      title: "People",
      body: {
        rows: [
          {
            id: "row-1",
            kind: "blocks",
            blocks: [
              text("person", "Avery is 37 years old."),
              {
                id: "derived",
                type: "prompt",
                atoms: [],
                display: "Avery is 99 years old.",
                marks: [],
                state: "idle"
              }
            ]
          }
        ]
      }
    }).exact;

    expect(projection.text).toBe("Avery is 37 years old.");
    expect(projection.encoding).toBe("utf-16");
    expect(projection.locators).toEqual([
      {
        from: 0,
        to: 22,
        locator: {
          kind: "documentBlock",
          area: "body",
          rowId: "row-1",
          blockPath: ["person"]
        }
      }
    ]);
  });

  it("uses visual order for visible slide elements and includes speaker notes", () => {
    const body: SlideDeckBody = {
      aspectRatio: "16:9",
      theme: { colors: { text: "#111", accent: "#09f" } },
      styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
      layouts: [],
      sections: [],
      slides: [
        {
          id: "slide-1",
          elements: [
            {
              id: "lower",
              frame: { x: 0, y: 100, width: 100, height: 20 },
              content: { type: "text", block: text("lower-block", "Second") }
            },
            {
              id: "upper",
              frame: { x: 0, y: 0, width: 100, height: 20 },
              content: { type: "shape", shape: "rectangle", block: text("upper-block", "First") }
            },
            {
              id: "generated",
              frame: { x: 0, y: 50, width: 100, height: 20 },
              content: {
                type: "prompt",
                block: {
                  id: "generated-block",
                  type: "prompt",
                  atoms: [{ id: "generated-atom", kind: "literal", text: "Do not re-ingest me" }],
                  display: "Do not re-ingest me",
                  marks: [],
                  state: "idle"
                }
              }
            }
          ],
          notes: [text("note", "Remember the age source")]
        },
        {
          id: "hidden",
          hidden: true,
          elements: [
            {
              id: "secret",
              frame: { x: 0, y: 0, width: 10, height: 10 },
              content: { type: "text", block: text("secret-block", "Not indexed") }
            }
          ],
          notes: []
        }
      ]
    };

    const projection = projectResource({
      kind: "slides",
      ref: { kind: "slides", id: asId<"slideDecks">("slideDecks:brief") },
      revision: 2,
      title: "Brief",
      body
    }).exact;

    expect(projection.text).toBe("First\n\nSecond\n\nRemember the age source");
    expect(projection.text).not.toContain("Do not re-ingest me");
    expect(projection.locators.map((span) => span.locator.kind)).toEqual([
      "slideElement",
      "slideElement",
      "slideNote"
    ]);
  });
});

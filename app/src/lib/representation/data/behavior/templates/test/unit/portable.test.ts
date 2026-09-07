import { describe, expect, it } from "vitest";

import type { DocumentBody } from "$representation/data/types/documents/body";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import { portableBodyOf } from "$representation/data/behavior/templates/portable";

const documentBody = (): DocumentBody => ({
  rows: [
    {
      id: "r1",
      kind: "blocks",
      blocks: [
        {
          id: "b1",
          type: "text",
          variant: "paragraph",
          atoms: [
            { id: "a1", kind: "literal", text: "See " },
            {
              id: "a2",
              kind: "formula",
              expression: "=total",
              formulaId: "formulas:1" as never,
              lastResolvedValue: { kind: "number", value: 4 },
              lastResolvedDisplay: "4",
              state: "fresh"
            }
          ],
          display: "See 4",
          marks: [
            { id: "m1", from: { atom: "a1", offset: 0 }, to: { atom: "a1", offset: 3 }, link: { kind: "url", url: "https://example.com" } },
            { id: "m2", from: { atom: "a1", offset: 0 }, to: { atom: "a1", offset: 2 }, style: ["bold"], link: { kind: "resource", ref: { kind: "document", id: "documents:1" } } }
          ]
        },
        { id: "b2", type: "image", alt: "Site", source: { kind: "file", fileId: "externalFiles:1" as never } },
        {
          id: "b3",
          type: "prompt",
          derivedOutputId: "derivedOutputs:1" as never,
          atoms: [{ id: "a3", kind: "literal", text: "Sum up" }],
          display: "Sum up",
          marks: [],
          scope: {
            include: [{ select: "kinds", kinds: ["finding"] }, { select: "set", setId: "resourceSets:1" as never }],
            exclude: [{ select: "resources", refs: [{ kind: "document", id: "documents:2" }] }]
          },
          state: "idle"
        }
      ]
    }
  ]
});

describe("portableBodyOf", () => {
  it("strips every project-bound field and says what went", () => {
    const { body, dropped } = portableBodyOf(documentBody());
    const row = body.rows[0];
    if (row.kind !== "blocks") throw new Error("blocks expected");
    const [text, image, prompt] = row.blocks;
    if (text.type !== "text" || image.type !== "image" || prompt.type !== "prompt") {
      throw new Error("block kinds moved");
    }
    expect("formulaId" in text.atoms[1]).toBe(false);
    expect(text.marks[0].link).toEqual({ kind: "url", url: "https://example.com" });
    expect(text.marks[1]).toEqual({ id: "m2", from: { atom: "a1", offset: 0 }, to: { atom: "a1", offset: 2 }, style: ["bold"] });
    expect("source" in image).toBe(false);
    expect("derivedOutputId" in prompt).toBe(false);
    expect(prompt.scope).toEqual({ include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] });
    expect(dropped).toEqual([
      "Dropped a formula's project binding.",
      "Dropped a link to something in the project.",
      "Dropped an image stored in the project.",
      "Dropped a prompt's generated output.",
      "Dropped 2 scope terms naming project resources."
    ]);
  });

  it("drops an image background from a deck theme and leaves colours alone", () => {
    const deck: SlideDeckBody = {
      aspectRatio: "16:9",
      theme: { background: { kind: "image", fileId: "externalFiles:2" as never, fit: "cover" }, colors: { text: "ink", accent: "blue" } },
      styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
      layouts: [],
      slides: [{ id: "s1", elements: [], notes: [], background: { kind: "color", color: "white" } }],
      sections: []
    };
    const { body, dropped } = portableBodyOf(deck);
    expect("background" in body.theme).toBe(false);
    expect(body.slides[0].background).toEqual({ kind: "color", color: "white" });
    expect(dropped).toEqual(["Dropped an image background."]);
  });

  it("leaves a portable body untouched and says nothing", () => {
    const held: DocumentBody = { rows: [{ id: "r1", kind: "pageBreak" }] };
    expect(portableBodyOf(held)).toEqual({ body: held, dropped: [] });
  });
});

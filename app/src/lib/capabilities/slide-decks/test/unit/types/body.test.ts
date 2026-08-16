import { describe, expect, it } from "vitest";
import { validate } from "convex-helpers/validators";
import {
  emptySlideDeckBody,
  slideDeckBodyValidator,
  slideElementValidator,
  slideValidator
} from "$slide-decks/types/body";

const element = {
  id: "e4",
  frame: { x: 0.1, y: 0.2, width: 0.8, height: 0.3 },
  blocks: [
    {
      id: "b1",
      type: "text",
      variant: "heading",
      atoms: [{ id: "a1", kind: "literal", text: "Q3" }],
      display: "Q3",
      marks: []
    }
  ],
  overflow: "shrink"
};

const slide = { id: "s12", layoutKey: "title-and-content", elements: [element], notes: [] };

describe("slideDeckBodyValidator", () => {
  it("holds the theme and the styles, so recolouring a deck is an edit", () => {
    expect(Object.keys(slideDeckBodyValidator.fields).sort()).toEqual([
      "handout",
      "layouts",
      "sections",
      "slides",
      "styles",
      "theme"
    ]);
  });

  it("admits a deck, and refuses one whose theme has no palette", () => {
    const body = emptySlideDeckBody();
    expect(validate(slideDeckBodyValidator, { ...body, slides: [slide] })).toBe(true);
    expect(validate(slideDeckBodyValidator, { ...body, theme: { colors: {} } })).toBe(false);
  });

  it("carries no aspect ratio, because that is the row's and no edit changes it", () => {
    expect(slideDeckBodyValidator.fields).not.toHaveProperty("aspectRatio");
  });

  it("sets a deck up for print separately from the shape of its slides", () => {
    const handout = {
      paper: "a4",
      orientation: "landscape",
      margins: { top: 36, right: 36, bottom: 36, left: 36 }
    };
    expect(validate(slideDeckBodyValidator, { ...emptySlideDeckBody(), handout })).toBe(true);
    expect(slideDeckBodyValidator.fields.handout.isOptional).toBe("optional");
  });
});

describe("a section", () => {
  it("names only its first slide, so an insert does not break it", () => {
    const section = { id: "sec1", name: "Findings", firstSlideId: "s12" };
    const body = { ...emptySlideDeckBody(), slides: [slide], sections: [section] };

    expect(validate(slideDeckBodyValidator, body)).toBe(true);
    // A start and an end would be two anchors to keep true; the second is what
    // an inserted slide invalidates.
    expect(validate(slideDeckBodyValidator, { ...body, sections: [{ ...section, lastSlideId: "s12" }] })).toBe(
      false
    );
  });
});

describe("a slide", () => {
  it("carries an id and no name — the thumbnail is the label", () => {
    expect(slideValidator.fields.id.kind).toBe("string");
    expect(slideValidator.fields).not.toHaveProperty("name");
    expect(slideValidator.fields).not.toHaveProperty("title");
  });

  it("holds notes as content blocks, so a speaker note can be a list or a link", () => {
    expect(slideValidator.fields.notes.kind).toBe("array");
    expect(validate(slideValidator, { ...slide, notes: [{ id: "b9", type: "text" }] })).toBe(false);
  });
});

describe("a slide element", () => {
  it("frames itself in fractions of the slide, so a phone and a PDF agree", () => {
    expect(validate(slideElementValidator, element)).toBe(true);
    expect(
      validate(slideElementValidator, { ...element, frame: { x: 0, y: 0, width: 1920, height: 1080 } })
    ).toBe(true);
    // Fractions are the contract, not something a validator can enforce — what
    // it can enforce is that a frame is four numbers and nothing else.
    expect(validate(slideElementValidator, { ...element, frame: { x: 0, y: 0, width: 1 } })).toBe(false);
  });

  it("says what to do when its content does not fit, because a box must decide", () => {
    for (const overflow of ["clip", "shrink", "grow"]) {
      expect(validate(slideElementValidator, { ...element, overflow })).toBe(true);
    }
    const { overflow: _overflow, ...undecided } = element;
    expect(validate(slideElementValidator, undecided)).toBe(false);
  });

  it("records the placeholder it came from without being driven by it", () => {
    expect(validate(slideElementValidator, { ...element, fromPlaceholder: "title" })).toBe(true);
    expect(slideElementValidator.fields.fromPlaceholder.isOptional).toBe("optional");
  });
});

describe("a slide background", () => {
  it("points at an uploaded file the same way an image block does", () => {
    const image = slideValidator.fields.background.members.find(
      (member) => member.fields.kind.value === "image"
    );
    const fields = image!.fields as Record<string, { kind: string; tableName?: string }>;

    expect(fields.fileId).toMatchObject({ kind: "id", tableName: "externalFiles" });
  });
});

describe("emptySlideDeckBody", () => {
  it("is a deck with no slides, and is a body the schema admits", () => {
    const body = emptySlideDeckBody();

    expect(body.slides).toEqual([]);
    expect(body.sections).toEqual([]);
    expect(validate(slideDeckBodyValidator, body)).toBe(true);
  });
});

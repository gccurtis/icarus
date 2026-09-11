import { describe, expect, it } from "vitest";

import type { PresentationBody } from "$representation/data/types/presentations/body";
import { presentationOfSlide } from "$representation/data/behavior/templates/presentation-of-slide";

const presentation: PresentationBody = {
  aspectRatio: "4:3",
  theme: { colors: { text: "ink", accent: "blue" } },
  styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
  layouts: [
    { id: "l1", key: "title", name: "Title", locked: [], placeholders: [] },
    { id: "l2", key: "blank", name: "Blank", locked: [], placeholders: [] }
  ],
  slides: [
    { id: "s1", layoutKey: "title", elements: [], notes: [] },
    { id: "s2", layoutKey: "blank", elements: [], notes: [] }
  ],
  sections: [{ id: "sec1", name: "One", firstSlideId: "s1" }]
};

describe("presentationOfSlide", () => {
  it("is a presentation holding one slide, its layout, the theme and the styles, and no sections", () => {
    expect(presentationOfSlide(presentation, "s2")).toEqual({
      aspectRatio: "4:3",
      theme: presentation.theme,
      styles: presentation.styles,
      layouts: [presentation.layouts[1]],
      slides: [presentation.slides[1]],
      sections: []
    });
  });

  it("answers nothing for a slide the presentation does not have", () => {
    expect(presentationOfSlide(presentation, "s9")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import { deckOfSlide } from "$representation/data/behavior/templates/deck-of-slide";

const deck: SlideDeckBody = {
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

describe("deckOfSlide", () => {
  it("is a deck holding one slide, its layout, the theme and the styles, and no sections", () => {
    expect(deckOfSlide(deck, "s2")).toEqual({
      aspectRatio: "4:3",
      theme: deck.theme,
      styles: deck.styles,
      layouts: [deck.layouts[1]],
      slides: [deck.slides[1]],
      sections: []
    });
  });

  it("answers nothing for a slide the deck does not have", () => {
    expect(deckOfSlide(deck, "s9")).toBeUndefined();
  });
});

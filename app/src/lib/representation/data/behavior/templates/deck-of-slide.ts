import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";

export const deckOfSlide = (
  deck: SlideDeckBody,
  slideId: string
): SlideDeckBody | undefined => {
  const slide = deck.slides.find((held) => held.id === slideId);
  if (slide === undefined) return undefined;
  const layout = deck.layouts.find((held) => held.key === slide.layoutKey);
  return {
    aspectRatio: deck.aspectRatio,
    theme: deck.theme,
    styles: deck.styles,
    layouts: layout === undefined ? [] : [layout],
    slides: [slide],
    sections: []
  };
};

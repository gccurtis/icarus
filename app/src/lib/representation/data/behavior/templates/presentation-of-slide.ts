import type { PresentationBody } from "$representation/data/types/presentations/body";

export const presentationOfSlide = (
  presentation: PresentationBody,
  slideId: string
): PresentationBody | undefined => {
  const slide = presentation.slides.find((held) => held.id === slideId);
  if (slide === undefined) return undefined;
  const layout = presentation.layouts.find((held) => held.key === slide.layoutKey);
  return {
    aspectRatio: presentation.aspectRatio,
    theme: presentation.theme,
    styles: presentation.styles,
    layouts: layout === undefined ? [] : [layout],
    slides: [slide],
    sections: []
  };
};

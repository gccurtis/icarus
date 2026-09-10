import { admitContentBlocks } from "$representation/data/behavior/content/admission";
import { isStoredSlideStyles } from "$representation/data/behavior/content/stored-format";
import {
  hasExactFields,
  isStoredIdentifier,
  isStoredText,
  storedFields
} from "$representation/data/behavior/core/stored";
import {
  isStoredFrame,
  isStoredSlideBackground,
  isStoredSlideElement
} from "$representation/data/behavior/slide-decks/stored-element";
import type {
  DeckSection,
  Slide,
  SlideDeckBody,
  SlideLayout,
  SlidePlaceholder
} from "$representation/data/types/slide-decks/body";

const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;

const isStoredPlaceholder = (value: unknown): value is SlidePlaceholder => {
  const placeholder = storedFields(value);
  return placeholder !== undefined &&
    hasExactFields(placeholder, ["role", "frame"], ["styleKey", "prompt"]) &&
    isStoredText(placeholder.role, 10_000) &&
    placeholder.role.length > 0 &&
    isStoredFrame(placeholder.frame) &&
    (placeholder.styleKey === undefined || isStoredIdentifier(placeholder.styleKey)) &&
    (placeholder.prompt === undefined || isStoredText(placeholder.prompt));
};

const isStoredLayout = (value: unknown): value is SlideLayout => {
  const layout = storedFields(value);
  return layout !== undefined &&
    hasExactFields(
      layout,
      ["id", "key", "name", "locked", "placeholders"],
      ["background"]
    ) &&
    isStoredIdentifier(layout.id) &&
    isStoredIdentifier(layout.key) &&
    isStoredText(layout.name, 10_000) &&
    layout.name.length > 0 &&
    Array.isArray(layout.locked) &&
    layout.locked.every(isStoredSlideElement) &&
    Array.isArray(layout.placeholders) &&
    layout.placeholders.every(isStoredPlaceholder) &&
    (layout.background === undefined || isStoredSlideBackground(layout.background));
};

const isStoredSlide = (value: unknown): value is Slide => {
  const slide = storedFields(value);
  return slide !== undefined &&
    hasExactFields(
      slide,
      ["id", "elements", "notes"],
      ["layoutKey", "background", "hidden"]
    ) &&
    isStoredIdentifier(slide.id) &&
    (slide.layoutKey === undefined || isStoredIdentifier(slide.layoutKey)) &&
    Array.isArray(slide.elements) &&
    slide.elements.every(isStoredSlideElement) &&
    admitContentBlocks(slide.notes) !== undefined &&
    (slide.background === undefined || isStoredSlideBackground(slide.background)) &&
    (slide.hidden === undefined || typeof slide.hidden === "boolean");
};

const isStoredSection = (value: unknown): value is DeckSection => {
  const section = storedFields(value);
  return section !== undefined &&
    hasExactFields(section, ["id", "name", "firstSlideId"]) &&
    isStoredIdentifier(section.id) &&
    isStoredText(section.name, 10_000) &&
    isStoredIdentifier(section.firstSlideId);
};

const isStoredTheme = (value: unknown): boolean => {
  const theme = storedFields(value);
  const colors = storedFields(theme?.colors);
  return theme !== undefined &&
    hasExactFields(theme, ["colors"], ["background", "fontFamily"]) &&
    colors !== undefined &&
    hasExactFields(colors, ["text", "accent"], ["muted"]) &&
    isStoredText(colors.text, 10_000) &&
    isStoredText(colors.accent, 10_000) &&
    (colors.muted === undefined || isStoredText(colors.muted, 10_000)) &&
    (theme.background === undefined || isStoredSlideBackground(theme.background)) &&
    (theme.fontFamily === undefined || isStoredText(theme.fontFamily, 10_000));
};

export const isStoredSlideDeckBody = (value: unknown): value is SlideDeckBody => {
  const body = storedFields(value);
  if (
    body === undefined ||
    !hasExactFields(body, ["aspectRatio", "theme", "styles", "layouts", "slides", "sections"]) ||
    typeof body.aspectRatio !== "string" ||
    !/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(body.aspectRatio) ||
    body.aspectRatio.split(":").some((part) => !Number.isFinite(Number(part)) || Number(part) <= 0) ||
    !isStoredTheme(body.theme) ||
    !isStoredSlideStyles(body.styles) ||
    !Array.isArray(body.layouts) ||
    !body.layouts.every(isStoredLayout) ||
    !Array.isArray(body.slides) ||
    !body.slides.every(isStoredSlide) ||
    !Array.isArray(body.sections) ||
    !body.sections.every(isStoredSection)
  ) return false;

  const layoutKeys = body.layouts.map((layout) => layout.key);
  const slideIds = body.slides.map((slide) => slide.id);
  return unique(body.layouts.map((layout) => layout.id)) &&
    unique(layoutKeys) &&
    unique(slideIds) &&
    unique(body.sections.map((section) => section.id)) &&
    body.slides.every((slide) => slide.layoutKey === undefined || layoutKeys.includes(slide.layoutKey)) &&
    body.sections.every((section) => slideIds.includes(section.firstSlideId));
};

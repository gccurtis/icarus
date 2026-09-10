import {
  collectBlocksIdentifiers,
  validBlock
} from "$capabilities/templates/api/shared/body-validation/blocks";
import { validStyles } from "$capabilities/templates/api/shared/body-validation/formats";
import {
  type Fields,
  MAX_BLOCKS_PER_CONTAINER,
  addUniqueIdentifier,
  hasOnlyKeys,
  isRecord,
  isText,
  validCanonicalText,
  validIdentifier,
  validText
} from "$capabilities/templates/api/shared/body-validation/primitives";
import {
  collectSlideElementIdentifiers,
  slideElementsUseOnlyRoles,
  validFrame,
  validSlideBackground,
  validSlideElement
} from "$capabilities/templates/api/shared/body-validation/slide-elements";

const validAspectRatio = (value: unknown): boolean => {
  if (!isText(value) || !/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(value)) return false;
  const [width, height] = value.split(":").map(Number);
  return width > 0 && width <= 10_000 && height > 0 && height <= 10_000;
};

export const validSlides = (body: Fields): boolean => {
  if (
    !hasOnlyKeys(body, ["resource", "aspectRatio", "theme", "styles", "layouts", "slides", "sections"]) ||
    !validAspectRatio(body.aspectRatio) ||
    !isRecord(body.theme) ||
    !hasOnlyKeys(body.theme, ["background", "colors", "fontFamily"]) ||
    !isRecord(body.theme.colors) ||
    !hasOnlyKeys(body.theme.colors, ["text", "accent", "muted"]) ||
    !validText(body.theme.colors.text, 1_000) ||
    !validText(body.theme.colors.accent, 1_000) ||
    (body.theme.colors.muted !== undefined && !validText(body.theme.colors.muted, 1_000)) ||
    (body.theme.background !== undefined && !validSlideBackground(body.theme.background)) ||
    (body.theme.fontFamily !== undefined && !validText(body.theme.fontFamily, 1_000)) ||
    !validStyles(body.styles) ||
    !Array.isArray(body.layouts) ||
    body.layouts.length > 512 ||
    !Array.isArray(body.slides) ||
    body.slides.length > 10_000 ||
    !Array.isArray(body.sections) ||
    body.sections.length > 1_000
  ) {
    return false;
  }
  const styles = (body.styles as Fields).styles as Fields;
  const identifiers = new Set<string>();
  const layoutKeys = new Set<string>();
  const placeholdersByLayout = new Map<string, Set<string>>();
  for (const layout of body.layouts) {
    if (
      !isRecord(layout) ||
      !hasOnlyKeys(layout, ["id", "key", "name", "locked", "placeholders", "background"]) ||
      !validIdentifier(layout.id) ||
      !validIdentifier(layout.key) ||
      layoutKeys.has(layout.key) ||
      !validCanonicalText(layout.name, 500) ||
      !Array.isArray(layout.locked) ||
      layout.locked.length > 2_000 ||
      !layout.locked.every((element) => validSlideElement(element)) ||
      !Array.isArray(layout.placeholders) ||
      layout.placeholders.length > 2_000 ||
      (layout.background !== undefined && !validSlideBackground(layout.background))
    ) {
      return false;
    }
    if (
      !addUniqueIdentifier(identifiers, layout.id) ||
      !layout.locked.every((element) =>
        collectSlideElementIdentifiers(element as Fields, identifiers)
      )
    ) {
      return false;
    }
    const roles = new Set<string>();
    for (const placeholder of layout.placeholders) {
      if (
        !isRecord(placeholder) ||
        !hasOnlyKeys(placeholder, ["role", "frame", "styleKey", "prompt"]) ||
        !validIdentifier(placeholder.role) ||
        roles.has(placeholder.role) ||
        !validFrame(placeholder.frame) ||
        (placeholder.styleKey !== undefined &&
          (!validIdentifier(placeholder.styleKey) ||
            !Object.prototype.hasOwnProperty.call(styles, placeholder.styleKey))) ||
        (placeholder.prompt !== undefined && !validText(placeholder.prompt, 4_000, true))
      ) {
        return false;
      }
      roles.add(placeholder.role);
    }
    if (
      !slideElementsUseOnlyRoles(layout.locked, roles)
    ) {
      return false;
    }
    layoutKeys.add(layout.key);
    placeholdersByLayout.set(layout.key, roles);
  }

  const slideIds = new Set<string>();
  for (const slide of body.slides) {
    if (
      !isRecord(slide) ||
      !hasOnlyKeys(slide, ["id", "layoutKey", "elements", "notes", "background", "hidden"]) ||
      !validIdentifier(slide.id) ||
      slideIds.has(slide.id) ||
      (slide.layoutKey !== undefined &&
        (!validIdentifier(slide.layoutKey) || !layoutKeys.has(slide.layoutKey))) ||
      !Array.isArray(slide.notes) ||
      slide.notes.length > MAX_BLOCKS_PER_CONTAINER ||
      !slide.notes.every((block) => validBlock(block)) ||
      !Array.isArray(slide.elements) ||
      slide.elements.length > 2_000 ||
      !slide.elements.every((element) => validSlideElement(element)) ||
      (slide.background !== undefined && !validSlideBackground(slide.background)) ||
      (slide.hidden !== undefined && typeof slide.hidden !== "boolean")
    ) {
      return false;
    }
    if (
      !addUniqueIdentifier(identifiers, slide.id) ||
      !collectBlocksIdentifiers(slide.notes, identifiers) ||
      !slide.elements.every((element) =>
        collectSlideElementIdentifiers(element as Fields, identifiers)
      )
    ) {
      return false;
    }
    const roles =
      slide.layoutKey === undefined ? undefined : placeholdersByLayout.get(slide.layoutKey);
    if (
      (roles === undefined
        ? !slideElementsUseOnlyRoles(slide.elements, new Set())
        : !slideElementsUseOnlyRoles(slide.elements, roles))
    ) {
      return false;
    }
    slideIds.add(slide.id);
  }

  const sectionIds = new Set<string>();
  return body.sections.every((section) => {
    if (
      !isRecord(section) ||
      !hasOnlyKeys(section, ["id", "name", "firstSlideId"]) ||
      !validIdentifier(section.id) ||
      sectionIds.has(section.id) ||
      !validCanonicalText(section.name, 500) ||
      !validIdentifier(section.firstSlideId) ||
      !slideIds.has(section.firstSlideId)
    ) {
      return false;
    }
    if (!addUniqueIdentifier(identifiers, section.id)) return false;
    sectionIds.add(section.id);
    return true;
  });
};

/** The exhaustive slide-body predicate used by template admission. */
export const validSlideTemplateBody = (value: unknown): boolean =>
  isRecord(value) && value.resource === "slides" && validSlides(value);

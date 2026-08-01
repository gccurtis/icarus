import type {
  DeckSnapshot,
  ElementPlacement,
  PromptContentShape,
  ShapeId,
  Slide,
  SlideElement,
  SlideElementId,
  SlideGroup,
  SlideOperation,
  SlideShape
} from "./model.js";

export const DECK_SLIDES_CONTAINER_ID = "$deck:slides";
export const DECK_STYLES_CONTAINER_ID = "$deck:styles";
export const DECK_CANVAS_ID = "$deck:canvas";
export const DECK_METADATA_ID = "$deck:metadata";

export const slideRootContainerId = (slideId: string): string =>
  `$slide:${slideId}:root`;

export const slideNotesContainerId = (slideId: string): string =>
  `$slide:${slideId}:notes`;

export const groupChildrenContainerId = (groupId: string): string =>
  `$group:${groupId}:children`;

export interface ElementContainerLocation {
  ids: SlideElementId[];
  parentGroup?: SlideGroup;
}

export interface ElementLocation extends ElementContainerLocation {
  slide: Slide;
  element: SlideElement;
  index: number;
}

export const findSlide = (
  snapshot: DeckSnapshot,
  slideId: string
): Slide | undefined => Object.hasOwn(snapshot.slides, slideId)
  ? snapshot.slides[slideId]
  : undefined;

export const getElementContainer = (
  slide: Slide,
  parentGroupId?: string
): ElementContainerLocation | undefined => {
  if (parentGroupId === undefined) return { ids: slide.rootElementIds };
  const parent = Object.hasOwn(slide.elements, parentGroupId)
    ? slide.elements[parentGroupId]
    : undefined;
  if (!parent || parent.elementKind !== "group") return undefined;
  return { ids: parent.childElementIds, parentGroup: parent };
};

export const findElementLocationInSlide = (
  slide: Slide,
  elementId: string
): ElementLocation | undefined => {
  const element = Object.hasOwn(slide.elements, elementId)
    ? slide.elements[elementId]
    : undefined;
  if (!element) return undefined;
  const rootIndex = slide.rootElementIds.indexOf(elementId);
  if (rootIndex >= 0) {
    return { slide, element, ids: slide.rootElementIds, index: rootIndex };
  }
  for (const candidate of Object.values(slide.elements)) {
    if (candidate.elementKind !== "group") continue;
    const index = candidate.childElementIds.indexOf(elementId);
    if (index >= 0) {
      return {
        slide,
        element,
        ids: candidate.childElementIds,
        parentGroup: candidate,
        index
      };
    }
  }
  return undefined;
};

export const findElementLocation = (
  snapshot: DeckSnapshot,
  elementId: string,
  slideId?: string
): ElementLocation | undefined => {
  if (slideId !== undefined) {
    const slide = Object.hasOwn(snapshot.slides, slideId)
      ? snapshot.slides[slideId]
      : undefined;
    return slide ? findElementLocationInSlide(slide, elementId) : undefined;
  }
  for (const id of snapshot.slideOrder) {
    const slide = Object.hasOwn(snapshot.slides, id) ? snapshot.slides[id] : undefined;
    if (!slide) continue;
    const location = findElementLocationInSlide(slide, elementId);
    if (location) return location;
  }
  return undefined;
};

export const findShape = (
  snapshot: DeckSnapshot,
  shapeId: ShapeId,
  slideId?: string
): SlideShape | undefined => {
  const location = findElementLocation(snapshot, shapeId, slideId);
  return location?.element.elementKind === "shape" ? location.element : undefined;
};

export const isPromptContentShape = (
  element: SlideElement | undefined
): element is PromptContentShape =>
  element?.elementKind === "shape" && element.shapeKind === "prompt-content";

export const findPromptContentShape = (
  snapshot: DeckSnapshot,
  shapeId: ShapeId
): PromptContentShape | undefined => {
  const shape = findShape(snapshot, shapeId);
  return isPromptContentShape(shape) ? shape : undefined;
};

export const walkSlideElements = (
  slide: Slide,
  visitor: (element: SlideElement, parentGroup?: SlideGroup) => void
): void => {
  const seen = new Set<string>();
  const visit = (ids: string[], parentGroup?: SlideGroup): void => {
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const element = Object.hasOwn(slide.elements, id) ? slide.elements[id] : undefined;
      if (!element) continue;
      visitor(element, parentGroup);
      if (element.elementKind === "group") visit(element.childElementIds, element);
    }
  };
  visit(slide.rootElementIds);
};

export const collectSubtreeIds = (
  slide: Slide,
  rootElementId: string
): string[] => {
  const result: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    const element = Object.hasOwn(slide.elements, id) ? slide.elements[id] : undefined;
    if (!element) return;
    result.push(id);
    if (element.elementKind === "group") {
      for (const childId of element.childElementIds) visit(childId);
    }
  };
  visit(rootElementId);
  return result;
};

export const collectSubtreeElements = (
  slide: Slide,
  rootElementId: string
): SlideElement[] => collectSubtreeIds(slide, rootElementId)
  .map((id) => Object.hasOwn(slide.elements, id) ? slide.elements[id] : undefined)
  .filter((element): element is SlideElement => element !== undefined)
  .map((element) => structuredClone(element));

export const isElementDescendantOf = (
  slide: Slide,
  possibleDescendantId: string,
  possibleAncestorId: string
): boolean => collectSubtreeIds(slide, possibleAncestorId)
  .slice(1)
  .includes(possibleDescendantId);

export const placementForLocation = (
  location: ElementLocation
): ElementPlacement => ({
  ...(location.parentGroup ? { parentGroupId: location.parentGroup.id } : {}),
  ...(location.index > 0 ? { afterElementId: location.ids[location.index - 1] } : {})
});

export const collectPromptContentShapes = (
  snapshot: DeckSnapshot
): PromptContentShape[] => {
  const result: PromptContentShape[] = [];
  for (const slideId of snapshot.slideOrder) {
    const slide = Object.hasOwn(snapshot.slides, slideId) ? snapshot.slides[slideId] : undefined;
    if (!slide) continue;
    for (const element of Object.values(slide.elements)) {
      if (isPromptContentShape(element)) result.push(element);
    }
  }
  return result;
};

export const slideContainsPromptContent = (slide: Slide): boolean =>
  Object.values(slide.elements).some(isPromptContentShape);

/** Operations generic public submit must reject because they create/retarget Prompt Content. */
export const operationIntroducesPromptContent = (
  operation: SlideOperation
): boolean => {
  if (operation.type === "slide.insert") return slideContainsPromptContent(operation.slide);
  if (operation.type === "shape.insert") return isPromptContentShape(operation.shape);
  if (operation.type === "element.restore-subtree") {
    return operation.elements.some(isPromptContentShape);
  }
  return operation.type === "prompt-content.apply-derived-output";
};

export const operationIsInternalOnly = (operation: SlideOperation): boolean =>
  operation.type === "element.restore-subtree" ||
  operation.type === "prompt-content.apply-derived-output";

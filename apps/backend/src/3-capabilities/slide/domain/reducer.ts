import type { RichContent, RichText, TextStyleProperties } from "#rich-text";
import type { RichTextOperation } from "#rich-text";
import { canonicalDigest } from "./canonical.js";
import {
  SlideOperationError,
  SlidePlacementError,
  SlideStyleReferenceError,
  SlideValidationError
} from "./errors.js";
import type {
  DeckSnapshot,
  ElementPlacement,
  ShapePresentationOverride,
  Slide,
  SlideElement,
  SlideLimits,
  SlideOperation,
  SlideShape,
  SlideStyle
} from "./model.js";
import {
  collectSubtreeElements,
  collectSubtreeIds,
  DECK_CANVAS_ID,
  DECK_METADATA_ID,
  DECK_SLIDES_CONTAINER_ID,
  DECK_STYLES_CONTAINER_ID,
  findElementLocationInSlide,
  getElementContainer,
  groupChildrenContainerId,
  isElementDescendantOf,
  placementForLocation,
  slideNotesContainerId,
  slideRootContainerId
} from "./tree.js";
import { validateSnapshot } from "./validation.js";
import { isSafeSlideIdentity } from "./validation.js";
import { collectSlideIdentities } from "./identities.js";

export interface SlideApplyResult {
  snapshot: DeckSnapshot;
  forward: SlideOperation[];
  inverse: SlideOperation[];
  touchedIds: string[];
}

const clone = <T>(value: T): T => structuredClone(value);

const requireSlide = (snapshot: DeckSnapshot, slideId: string): Slide => {
  const slide = Object.hasOwn(snapshot.slides, slideId) ? snapshot.slides[slideId] : undefined;
  if (!slide) throw new SlideOperationError(`Slide not found: ${slideId}`);
  return slide;
};

const requireElement = (slide: Slide, elementId: string): SlideElement => {
  const element = Object.hasOwn(slide.elements, elementId) ? slide.elements[elementId] : undefined;
  if (!element) throw new SlideOperationError(`Element not found: ${elementId}`);
  return element;
};

const requireShape = (slide: Slide, shapeId: string): SlideShape => {
  const element = requireElement(slide, shapeId);
  if (element.elementKind !== "shape") throw new SlideOperationError(`Element is not a Shape: ${shapeId}`);
  return element;
};

const requireStyle = (snapshot: DeckSnapshot, styleId: string): SlideStyle => {
  const style = snapshot.styles.styles.find((candidate) => candidate.id === styleId);
  if (!style) throw new SlideStyleReferenceError(styleId);
  return style;
};

const overlay = <T extends object>(base: T, over: T): T => {
  const result = { ...base };
  for (const key of Object.keys(over) as Array<keyof T>) {
    if (over[key] !== undefined) result[key] = over[key];
  }
  return result;
};

export const resolveSlideStyle = (
  snapshot: DeckSnapshot,
  styleId: string
): { visual: SlideStyle["visual"]; text: TextStyleProperties } => {
  const chain: SlideStyle[] = [];
  const seen = new Set<string>();
  let current = requireStyle(snapshot, styleId);
  while (true) {
    if (seen.has(current.id)) throw new SlideStyleReferenceError(styleId, "Style inheritance cycle");
    seen.add(current.id);
    chain.unshift(current);
    if (!current.basedOnStyleId) break;
    current = requireStyle(snapshot, current.basedOnStyleId);
  }
  let visual: SlideStyle["visual"] = {};
  let text: TextStyleProperties = {};
  for (const style of chain) {
    visual = overlay(visual, style.visual);
    text = overlay(text, style.text);
  }
  return { visual, text };
};

export const resolveShapeStyle = (
  snapshot: DeckSnapshot,
  shape: SlideShape
): { visual: SlideStyle["visual"]; text: TextStyleProperties } => {
  const kindDefault = resolveSlideStyle(
    snapshot,
    snapshot.styles.defaultStyleIdByShapeKind[shape.shapeKind]
  );
  const selected = resolveSlideStyle(snapshot, shape.styleId);
  const presentation: ShapePresentationOverride = shape.presentation ?? {};
  return {
    visual: overlay(overlay(kindDefault.visual, selected.visual), presentation.visual ?? {}),
    text: overlay(overlay(kindDefault.text, selected.text), presentation.text ?? {})
  };
};

const insertAfter = (
  ids: string[],
  id: string,
  afterId: string | undefined,
  label: string
): void => {
  if (afterId === undefined) {
    ids.unshift(id);
    return;
  }
  const index = ids.indexOf(afterId);
  if (index < 0) throw new SlidePlacementError(`${label} anchor not found: ${afterId}`);
  ids.splice(index + 1, 0, id);
};

const insertElement = (
  slide: Slide,
  element: SlideElement,
  placement: ElementPlacement
): void => {
  if (Object.hasOwn(slide.elements, element.id)) throw new SlideOperationError(`Element already exists: ${element.id}`);
  if (!isSafeSlideIdentity(element.id)) throw new SlideOperationError(`Unsafe element identity: ${element.id}`);
  const container = getElementContainer(slide, placement.parentGroupId);
  if (!container) throw new SlidePlacementError(`Parent Group not found: ${placement.parentGroupId}`);
  if (placement.afterElementId === element.id) throw new SlidePlacementError("An element cannot follow itself");
  if (placement.afterElementId !== undefined && !container.ids.includes(placement.afterElementId)) {
    throw new SlidePlacementError("Element anchor is not in the target container");
  }
  slide.elements[element.id] = element;
  insertAfter(container.ids, element.id, placement.afterElementId, "Element");
};

const removeElementSubtree = (
  slide: Slide,
  rootElementId: string
): void => {
  const location = findElementLocationInSlide(slide, rootElementId);
  if (!location) throw new SlideOperationError(`Element not found in ordering tree: ${rootElementId}`);
  location.ids.splice(location.index, 1);
  for (const id of collectSubtreeIds(slide, rootElementId)) delete slide.elements[id];
};

/**
 * Structural Groups cannot survive without children. Return the inner-to-outer
 * chain that becomes empty when `location.element` leaves its container.
 * A destination ancestor is excluded because receiving the moved element will
 * keep that Group non-empty.
 */
const groupsPrunedAfterRemoval = (
  slide: Slide,
  elementId: string,
  destinationParentGroupId?: string
): SlideElement[] => {
  const result: SlideElement[] = [];
  let location = findElementLocationInSlide(slide, elementId);
  let childId = elementId;
  while (location?.parentGroup &&
         location.parentGroup.id !== destinationParentGroupId &&
         location.parentGroup.childElementIds.length === 1 &&
         location.parentGroup.childElementIds[0] === childId) {
    const group = location.parentGroup;
    result.push(group);
    childId = group.id;
    location = findElementLocationInSlide(slide, group.id);
  }
  return result;
};

const richContentOfTextShape = (shape: SlideShape): RichContent => {
  if (shape.shapeKind !== "text") throw new SlideOperationError(`Shape ${shape.id} is not authored Text`);
  return shape.content;
};

const assertNoRichIdentityChurn = (operations: RichTextOperation[]): void => {
  const added = new Set<string>();
  const removed = new Set<string>();
  for (const operation of operations) {
    const addedIds: string[] = [];
    let removedId: string | undefined;
    if (operation.type === "insert-atom") {
      addedIds.push(operation.atom.id);
    } else if (operation.type === "replace-range-with-atom") {
      addedIds.push(operation.atom.id);
      if (operation.trailingTextAtomId) addedIds.push(operation.trailingTextAtomId);
    } else if (operation.type === "delete-atom") {
      removedId = operation.atomId;
    } else if (operation.type === "add-mark") {
      addedIds.push(operation.mark.id);
    } else if (operation.type === "remove-mark") {
      removedId = operation.markId;
    }
    for (const addedId of addedIds) {
      if (removed.has(addedId)) throw new SlideOperationError(`Rich Text identity cannot be re-added in one batch: ${addedId}`);
      added.add(addedId);
    }
    if (removedId) {
      if (added.has(removedId)) throw new SlideOperationError(`Rich Text identity cannot be removed after insertion in one batch: ${removedId}`);
      removed.add(removedId);
    }
  }
};

const applyOne = (
  snapshot: DeckSnapshot,
  operation: SlideOperation,
  richText: RichText
): SlideOperation[] => {
  switch (operation.type) {
    case "deck.rename": {
      const title = snapshot.title;
      snapshot.title = operation.title;
      return [{ type: "deck.rename", title }];
    }
    case "deck.set-lifecycle": {
      const lifecycle = snapshot.lifecycle;
      snapshot.lifecycle = operation.lifecycle;
      return [{ type: "deck.set-lifecycle", lifecycle }];
    }
    case "deck.set-canvas": {
      const canvas = clone(snapshot.canvas);
      snapshot.canvas = clone(operation.canvas);
      return [{ type: "deck.set-canvas", canvas }];
    }
    case "style.create": {
      if (!isSafeSlideIdentity(operation.style.id)) throw new SlideOperationError(`Unsafe Style identity: ${operation.style.id}`);
      if (snapshot.styles.styles.some((style) => style.id === operation.style.id)) {
        throw new SlideOperationError(`Style already exists: ${operation.style.id}`);
      }
      const replacement = snapshot.styles.defaultStyleIdByShapeKind.text;
      snapshot.styles.styles.push(clone(operation.style));
      return [{ type: "style.delete", styleId: operation.style.id, replacementStyleId: replacement }];
    }
    case "style.update": {
      const index = snapshot.styles.styles.findIndex((style) => style.id === operation.styleId);
      if (index < 0) throw new SlideStyleReferenceError(operation.styleId);
      if (operation.style.id !== operation.styleId) {
        throw new SlideOperationError("style.update cannot change Style identity");
      }
      const style = clone(snapshot.styles.styles[index]);
      snapshot.styles.styles[index] = clone(operation.style);
      return [{ type: "style.update", styleId: operation.styleId, style }];
    }
    case "style.delete": {
      const deleted = clone(requireStyle(snapshot, operation.styleId));
      requireStyle(snapshot, operation.replacementStyleId);
      if (operation.styleId === operation.replacementStyleId) {
        throw new SlideOperationError("A Style cannot replace itself during deletion");
      }
      const changedStyles = snapshot.styles.styles
        .filter((style) => style.basedOnStyleId === operation.styleId)
        .map(clone);
      const changedDefaults = Object.entries(snapshot.styles.defaultStyleIdByShapeKind)
        .filter(([, styleId]) => styleId === operation.styleId)
        .map(([shapeKind, styleId]) => ({ shapeKind: shapeKind as keyof typeof snapshot.styles.defaultStyleIdByShapeKind, styleId }));
      const changedShapes: Array<{ slideId: string; shapeId: string }> = [];
      for (const slideId of snapshot.slideOrder) {
        const slide = snapshot.slides[slideId];
        for (const element of Object.values(slide.elements)) {
          if (element.elementKind === "shape" && element.styleId === operation.styleId) {
            changedShapes.push({ slideId, shapeId: element.id });
            element.styleId = operation.replacementStyleId;
          }
        }
      }
      snapshot.styles.styles = snapshot.styles.styles
        .filter((style) => style.id !== operation.styleId)
        .map((style) => style.basedOnStyleId === operation.styleId
          ? { ...style, basedOnStyleId: operation.replacementStyleId }
          : style);
      for (const item of changedDefaults) {
        snapshot.styles.defaultStyleIdByShapeKind[item.shapeKind] = operation.replacementStyleId;
      }
      return [
        { type: "style.create", style: deleted },
        ...changedStyles.map((style): SlideOperation => ({ type: "style.update", styleId: style.id, style })),
        ...changedDefaults.map((item): SlideOperation => ({
          type: "style.set-default",
          shapeKind: item.shapeKind,
          styleId: item.styleId
        })),
        ...changedShapes.map((item): SlideOperation => ({
          type: "shape.set-style",
          slideId: item.slideId,
          shapeId: item.shapeId,
          styleId: operation.styleId
        }))
      ];
    }
    case "style.set-default": {
      requireStyle(snapshot, operation.styleId);
      const styleId = snapshot.styles.defaultStyleIdByShapeKind[operation.shapeKind];
      snapshot.styles.defaultStyleIdByShapeKind[operation.shapeKind] = operation.styleId;
      return [{ type: "style.set-default", shapeKind: operation.shapeKind, styleId }];
    }
    case "slide.insert": {
      if (!isSafeSlideIdentity(operation.slide.id)) throw new SlideOperationError(`Unsafe Slide identity: ${operation.slide.id}`);
      if (Object.hasOwn(snapshot.slides, operation.slide.id)) throw new SlideOperationError(`Slide already exists: ${operation.slide.id}`);
      if (operation.afterSlideId !== undefined && !snapshot.slideOrder.includes(operation.afterSlideId)) {
        throw new SlidePlacementError(`Slide anchor not found: ${operation.afterSlideId}`);
      }
      snapshot.slides[operation.slide.id] = clone(operation.slide);
      insertAfter(snapshot.slideOrder, operation.slide.id, operation.afterSlideId, "Slide");
      return [{ type: "slide.delete", slideId: operation.slide.id }];
    }
    case "slide.move": {
      const index = snapshot.slideOrder.indexOf(operation.slideId);
      if (index < 0) throw new SlideOperationError(`Slide not found: ${operation.slideId}`);
      if (operation.afterSlideId === operation.slideId) throw new SlidePlacementError("A Slide cannot follow itself");
      const prior = index > 0 ? snapshot.slideOrder[index - 1] : undefined;
      snapshot.slideOrder.splice(index, 1);
      insertAfter(snapshot.slideOrder, operation.slideId, operation.afterSlideId, "Slide");
      return [{ type: "slide.move", slideId: operation.slideId, ...(prior ? { afterSlideId: prior } : {}) }];
    }
    case "slide.delete": {
      if (snapshot.slideOrder.length <= 1) throw new SlideOperationError("A Deck must retain at least one Slide");
      const index = snapshot.slideOrder.indexOf(operation.slideId);
      if (index < 0) throw new SlideOperationError(`Slide not found: ${operation.slideId}`);
      const slide = clone(snapshot.slides[operation.slideId]);
      const prior = index > 0 ? snapshot.slideOrder[index - 1] : undefined;
      snapshot.slideOrder.splice(index, 1);
      delete snapshot.slides[operation.slideId];
      return [{ type: "slide.insert", slide, ...(prior ? { afterSlideId: prior } : {}) }];
    }
    case "slide.set-title": {
      const slide = requireSlide(snapshot, operation.slideId);
      const title = slide.title;
      if (operation.title === undefined) delete slide.title;
      else slide.title = operation.title;
      return [{ type: "slide.set-title", slideId: slide.id, ...(title !== undefined ? { title } : {}) }];
    }
    case "slide.set-background": {
      const slide = requireSlide(snapshot, operation.slideId);
      const background = clone(slide.background);
      slide.background = clone(operation.background);
      return [{ type: "slide.set-background", slideId: slide.id, background }];
    }
    case "notes.apply": {
      const slide = requireSlide(snapshot, operation.slideId);
      assertNoRichIdentityChurn(operation.operations);
      const result = richText.apply(slide.notes, operation.operations);
      slide.notes = result.content;
      return [{ type: "notes.apply", slideId: slide.id, operations: result.inverse }];
    }
    case "group.create": {
      const slide = requireSlide(snapshot, operation.slideId);
      const group = clone(operation.group);
      if (Object.hasOwn(slide.elements, group.id)) throw new SlideOperationError(`Element already exists: ${group.id}`);
      if (group.childElementIds.length === 0) throw new SlidePlacementError("A Group must wrap at least one element");
      const locations = group.childElementIds.map((id) => findElementLocationInSlide(slide, id));
      if (locations.some((location) => !location)) throw new SlidePlacementError("Every grouped element must exist");
      const first = locations[0]!;
      if (locations.some((location) => location!.ids !== first.ids)) {
        throw new SlidePlacementError("Grouped elements must be siblings");
      }
      const indexes = locations.map((location) => location!.index);
      if (indexes.some((index, offset) => index !== first.index + offset) ||
          group.childElementIds.some((id, offset) => first.ids[first.index + offset] !== id)) {
        throw new SlidePlacementError("Grouped elements must be contiguous and ordered");
      }
      first.ids.splice(first.index, group.childElementIds.length, group.id);
      slide.elements[group.id] = group;
      return [{ type: "group.ungroup", slideId: slide.id, groupId: group.id }];
    }
    case "group.ungroup": {
      const slide = requireSlide(snapshot, operation.slideId);
      const location = findElementLocationInSlide(slide, operation.groupId);
      if (!location || location.element.elementKind !== "group") {
        throw new SlideOperationError(`Group not found: ${operation.groupId}`);
      }
      const group = clone(location.element);
      location.ids.splice(location.index, 1, ...group.childElementIds);
      delete slide.elements[group.id];
      return [{ type: "group.create", slideId: slide.id, group }];
    }
    case "shape.insert": {
      const slide = requireSlide(snapshot, operation.slideId);
      insertElement(slide, clone(operation.shape), operation.placement);
      return [{ type: "element.delete", slideId: slide.id, elementId: operation.shape.id }];
    }
    case "element.restore-subtree": {
      const slide = requireSlide(snapshot, operation.slideId);
      if (operation.elements.some((element) => Object.hasOwn(slide.elements, element.id))) {
        throw new SlideOperationError("Restored subtree contains an existing identity");
      }
      const root = operation.elements.find((element) => element.id === operation.rootElementId);
      if (!root) throw new SlideOperationError("Restored subtree is missing its root element");
      const adoptedLocation = operation.adoptedElementId
        ? findElementLocationInSlide(slide, operation.adoptedElementId)
        : undefined;
      if (operation.adoptedElementId && !adoptedLocation) {
        throw new SlideOperationError(`Adopted element not found: ${operation.adoptedElementId}`);
      }
      const adoptedInversePlacement = adoptedLocation
        ? placementForLocation(adoptedLocation)
        : undefined;
      const container = getElementContainer(slide, operation.placement.parentGroupId);
      if (!container) throw new SlidePlacementError(`Parent Group not found: ${operation.placement.parentGroupId}`);
      if (operation.placement.afterElementId !== undefined &&
          !container.ids.includes(operation.placement.afterElementId)) {
        throw new SlidePlacementError("Element anchor is not in the target container");
      }
      if (adoptedLocation) adoptedLocation.ids.splice(adoptedLocation.index, 1);
      for (const element of operation.elements) slide.elements[element.id] = clone(element);
      insertAfter(container.ids, root.id, operation.placement.afterElementId, "Element");
      if (operation.adoptedElementId && adoptedInversePlacement) {
        return [{
          type: "element.move",
          slideId: slide.id,
          elementId: operation.adoptedElementId,
          placement: adoptedInversePlacement
        }];
      }
      return [{ type: "element.delete", slideId: slide.id, elementId: root.id }];
    }
    case "element.move": {
      const slide = requireSlide(snapshot, operation.slideId);
      const source = findElementLocationInSlide(slide, operation.elementId);
      if (!source) throw new SlideOperationError(`Element not found: ${operation.elementId}`);
      if (operation.placement.afterElementId === operation.elementId) {
        throw new SlidePlacementError("An element cannot follow itself");
      }
      if (operation.placement.parentGroupId === operation.elementId ||
          (operation.placement.parentGroupId !== undefined &&
           isElementDescendantOf(slide, operation.placement.parentGroupId, operation.elementId))) {
        throw new SlidePlacementError("An element cannot move into itself or its descendant");
      }
      const inversePlacement = placementForLocation(source);
      const targetBefore = getElementContainer(slide, operation.placement.parentGroupId);
      if (!targetBefore) throw new SlidePlacementError(`Parent Group not found: ${operation.placement.parentGroupId}`);
      const sameContainer = targetBefore.ids === source.ids;
      const prunedGroups = sameContainer
        ? []
        : groupsPrunedAfterRemoval(slide, operation.elementId, operation.placement.parentGroupId);
      const outerPruned = prunedGroups.at(-1);
      const outerLocation = outerPruned
        ? findElementLocationInSlide(slide, outerPruned.id)
        : undefined;
      const restoredGroups = outerPruned
        ? prunedGroups.map((group) => clone(group))
        : [];
      const restoredPlacement = outerLocation
        ? placementForLocation(outerLocation)
        : undefined;
      if (operation.placement.afterElementId !== undefined &&
          prunedGroups.some((group) => group.id === operation.placement.afterElementId)) {
        throw new SlidePlacementError("Element anchor would be pruned by this move");
      }
      source.ids.splice(source.index, 1);
      if (outerPruned && outerLocation) {
        const currentOuterIndex = outerLocation.ids.indexOf(outerPruned.id);
        if (currentOuterIndex >= 0) outerLocation.ids.splice(currentOuterIndex, 1);
        for (const group of prunedGroups) delete slide.elements[group.id];
      }
      const target = targetBefore;
      if (operation.placement.afterElementId !== undefined && !target.ids.includes(operation.placement.afterElementId)) {
        throw new SlidePlacementError("Element anchor is not in the target container");
      }
      insertAfter(target.ids, operation.elementId, operation.placement.afterElementId, "Element");
      if (outerPruned && restoredPlacement) {
        return [{
          type: "element.restore-subtree",
          slideId: slide.id,
          rootElementId: outerPruned.id,
          elements: restoredGroups,
          placement: restoredPlacement,
          adoptedElementId: operation.elementId
        }];
      }
      return [{ type: "element.move", slideId: slide.id, elementId: operation.elementId, placement: inversePlacement }];
    }
    case "element.delete": {
      const slide = requireSlide(snapshot, operation.slideId);
      const location = findElementLocationInSlide(slide, operation.elementId);
      if (!location) throw new SlideOperationError(`Element not found: ${operation.elementId}`);
      const prunedGroups = groupsPrunedAfterRemoval(slide, operation.elementId);
      const inverseRootId = prunedGroups.at(-1)?.id ?? operation.elementId;
      const inverseLocation = findElementLocationInSlide(slide, inverseRootId);
      if (!inverseLocation) throw new SlideOperationError(`Element not found: ${inverseRootId}`);
      const elements = collectSubtreeElements(slide, inverseRootId);
      const placement = placementForLocation(inverseLocation);
      removeElementSubtree(slide, inverseRootId);
      return [{
        type: "element.restore-subtree",
        slideId: slide.id,
        rootElementId: inverseRootId,
        elements,
        placement
      }];
    }
    case "element.set-locked": {
      const slide = requireSlide(snapshot, operation.slideId);
      const element = requireElement(slide, operation.elementId);
      const locked = element.locked;
      element.locked = operation.locked;
      return [{ type: "element.set-locked", slideId: slide.id, elementId: element.id, locked }];
    }
    case "element.set-hidden": {
      const slide = requireSlide(snapshot, operation.slideId);
      const element = requireElement(slide, operation.elementId);
      const hidden = element.hidden;
      element.hidden = operation.hidden;
      return [{ type: "element.set-hidden", slideId: slide.id, elementId: element.id, hidden }];
    }
    case "shape.set-frame": {
      const shape = requireShape(requireSlide(snapshot, operation.slideId), operation.shapeId);
      const frame = clone(shape.frame);
      shape.frame = clone(operation.frame);
      return [{ type: "shape.set-frame", slideId: operation.slideId, shapeId: shape.id, frame }];
    }
    case "shape.set-transform": {
      const shape = requireShape(requireSlide(snapshot, operation.slideId), operation.shapeId);
      const transform = clone(shape.transform);
      shape.transform = clone(operation.transform);
      return [{ type: "shape.set-transform", slideId: operation.slideId, shapeId: shape.id, transform }];
    }
    case "shape.set-style": {
      requireStyle(snapshot, operation.styleId);
      const shape = requireShape(requireSlide(snapshot, operation.slideId), operation.shapeId);
      const styleId = shape.styleId;
      shape.styleId = operation.styleId;
      return [{ type: "shape.set-style", slideId: operation.slideId, shapeId: shape.id, styleId }];
    }
    case "shape.set-presentation": {
      const shape = requireShape(requireSlide(snapshot, operation.slideId), operation.shapeId);
      const presentation = clone(shape.presentation);
      if (operation.presentation === undefined) delete shape.presentation;
      else shape.presentation = clone(operation.presentation);
      return [{
        type: "shape.set-presentation",
        slideId: operation.slideId,
        shapeId: shape.id,
        ...(presentation !== undefined ? { presentation } : {})
      }];
    }
    case "text-box.set-presentation": {
      const shape = requireShape(requireSlide(snapshot, operation.slideId), operation.shapeId);
      if (shape.shapeKind !== "text" && shape.shapeKind !== "prompt-content") {
        throw new SlideOperationError(`Shape ${shape.id} has no text-box presentation`);
      }
      const textBox = clone(shape.textBox);
      shape.textBox = clone(operation.textBox);
      return [{ type: "text-box.set-presentation", slideId: operation.slideId, shapeId: shape.id, textBox }];
    }
    case "text.apply": {
      const shape = requireShape(requireSlide(snapshot, operation.slideId), operation.shapeId);
      assertNoRichIdentityChurn(operation.operations);
      const result = richText.apply(richContentOfTextShape(shape), operation.operations);
      if (shape.shapeKind !== "text") throw new SlideOperationError(`Shape ${shape.id} is not authored Text`);
      shape.content = result.content;
      return [{ type: "text.apply", slideId: operation.slideId, shapeId: shape.id, operations: result.inverse }];
    }
    case "prompt-content.apply-derived-output": {
      const shape = requireShape(requireSlide(snapshot, operation.slideId), operation.shapeId);
      if (shape.shapeKind !== "prompt-content") throw new SlideOperationError(`Shape ${shape.id} is not Prompt Content`);
      if (shape.output.outputId !== operation.output.outputId) {
        throw new SlideOperationError("Prompt Content cannot adopt another Derived Output identity");
      }
      const output = clone(shape.output);
      shape.output = clone(operation.output);
      return [{ type: "prompt-content.apply-derived-output", slideId: operation.slideId, shapeId: shape.id, output }];
    }
    case "geometry.set": {
      const shape = requireShape(requireSlide(snapshot, operation.slideId), operation.shapeId);
      if (shape.shapeKind !== "geometry") throw new SlideOperationError(`Shape ${shape.id} is not Geometry`);
      const geometry = clone(shape.geometry);
      shape.geometry = clone(operation.geometry);
      return [{ type: "geometry.set", slideId: operation.slideId, shapeId: shape.id, geometry }];
    }
    case "line.set": {
      const shape = requireShape(requireSlide(snapshot, operation.slideId), operation.shapeId);
      if (shape.shapeKind !== "line") throw new SlideOperationError(`Shape ${shape.id} is not a Line`);
      const line = clone(shape.line);
      shape.line = clone(operation.line);
      return [{ type: "line.set", slideId: operation.slideId, shapeId: shape.id, line }];
    }
    case "image.set": {
      const shape = requireShape(requireSlide(snapshot, operation.slideId), operation.shapeId);
      if (shape.shapeKind !== "image") throw new SlideOperationError(`Shape ${shape.id} is not an Image`);
      const image = clone(shape.image);
      shape.image = clone(operation.image);
      return [{ type: "image.set", slideId: operation.slideId, shapeId: shape.id, image }];
    }
    case "table.set": {
      const shape = requireShape(requireSlide(snapshot, operation.slideId), operation.shapeId);
      if (shape.shapeKind !== "table") throw new SlideOperationError(`Shape ${shape.id} is not a Table`);
      const table = clone(shape.table);
      shape.table = clone(operation.table);
      return [{ type: "table.set", slideId: operation.slideId, shapeId: shape.id, table }];
    }
    case "chart.set": {
      const shape = requireShape(requireSlide(snapshot, operation.slideId), operation.shapeId);
      if (shape.shapeKind !== "chart") throw new SlideOperationError(`Shape ${shape.id} is not a Chart`);
      const chart = clone(shape.chart);
      shape.chart = clone(operation.chart);
      return [{ type: "chart.set", slideId: operation.slideId, shapeId: shape.id, chart }];
    }
  }
};

const addRichIds = (content: RichContent, ids: Set<string>): void => {
  for (const atom of content.atoms) ids.add(atom.id);
  for (const mark of content.marks) ids.add(mark.id);
};

const addElementIds = (element: SlideElement, ids: Set<string>): void => {
  ids.add(element.id);
  if (element.elementKind === "group") {
    ids.add(groupChildrenContainerId(element.id));
    for (const childId of element.childElementIds) ids.add(childId);
  } else {
    ids.add(element.styleId);
    if (element.shapeKind === "text") addRichIds(element.content, ids);
  }
};

const addSlideIds = (slide: Slide, ids: Set<string>): void => {
  ids.add(slide.id);
  ids.add(slideRootContainerId(slide.id));
  ids.add(slideNotesContainerId(slide.id));
  addRichIds(slide.notes, ids);
  for (const element of Object.values(slide.elements)) addElementIds(element, ids);
};

const containerId = (slideId: string, parentGroupId?: string): string =>
  parentGroupId ? groupChildrenContainerId(parentGroupId) : slideRootContainerId(slideId);

const operationIds = (snapshot: DeckSnapshot, operation: SlideOperation): string[] => {
  const ids = new Set<string>();
  const addShapeTarget = (slideId: string, shapeId: string): void => {
    ids.add(slideId);
    ids.add(shapeId);
  };
  switch (operation.type) {
    case "deck.rename":
    case "deck.set-lifecycle":
      ids.add(DECK_METADATA_ID);
      break;
    case "deck.set-canvas":
      ids.add(DECK_CANVAS_ID);
      break;
    case "style.create":
      ids.add(DECK_STYLES_CONTAINER_ID);
      ids.add(operation.style.id);
      break;
    case "style.update":
      ids.add(operation.styleId);
      break;
    case "style.delete":
      ids.add(DECK_STYLES_CONTAINER_ID);
      ids.add(operation.styleId);
      ids.add(operation.replacementStyleId);
      for (const style of snapshot.styles.styles) {
        if (style.basedOnStyleId === operation.styleId) ids.add(style.id);
      }
      for (const slide of Object.values(snapshot.slides)) {
        for (const element of Object.values(slide.elements)) {
          if (element.elementKind === "shape" && element.styleId === operation.styleId) ids.add(element.id);
        }
      }
      break;
    case "style.set-default":
      ids.add(DECK_STYLES_CONTAINER_ID);
      ids.add(operation.styleId);
      break;
    case "slide.insert":
      ids.add(DECK_SLIDES_CONTAINER_ID);
      if (operation.afterSlideId) ids.add(operation.afterSlideId);
      addSlideIds(operation.slide, ids);
      break;
    case "slide.move":
    case "slide.delete": {
      ids.add(DECK_SLIDES_CONTAINER_ID);
      ids.add(operation.slideId);
      if (operation.type === "slide.move" && operation.afterSlideId) ids.add(operation.afterSlideId);
      const slide = snapshot.slides[operation.slideId];
      if (operation.type === "slide.delete" && slide) addSlideIds(slide, ids);
      break;
    }
    case "slide.set-title":
    case "slide.set-background":
      ids.add(operation.slideId);
      break;
    case "notes.apply":
      ids.add(operation.slideId);
      ids.add(slideNotesContainerId(operation.slideId));
      break;
    case "group.create": {
      ids.add(operation.slideId);
      addElementIds(operation.group, ids);
      const slide = snapshot.slides[operation.slideId];
      const first = slide ? findElementLocationInSlide(slide, operation.group.childElementIds[0] ?? "") : undefined;
      ids.add(containerId(operation.slideId, first?.parentGroup?.id));
      break;
    }
    case "group.ungroup": {
      ids.add(operation.slideId);
      ids.add(operation.groupId);
      ids.add(groupChildrenContainerId(operation.groupId));
      const slide = snapshot.slides[operation.slideId];
      const location = slide ? findElementLocationInSlide(slide, operation.groupId) : undefined;
      ids.add(containerId(operation.slideId, location?.parentGroup?.id));
      if (location?.element.elementKind === "group") {
        for (const childId of location.element.childElementIds) ids.add(childId);
      }
      break;
    }
    case "shape.insert":
      ids.add(operation.slideId);
      addElementIds(operation.shape, ids);
      ids.add(containerId(operation.slideId, operation.placement.parentGroupId));
      if (operation.placement.afterElementId) ids.add(operation.placement.afterElementId);
      break;
    case "element.restore-subtree":
      ids.add(operation.slideId);
      for (const element of operation.elements) addElementIds(element, ids);
      if (operation.adoptedElementId) ids.add(operation.adoptedElementId);
      ids.add(containerId(operation.slideId, operation.placement.parentGroupId));
      if (operation.placement.afterElementId) ids.add(operation.placement.afterElementId);
      break;
    case "element.move":
    case "element.delete": {
      ids.add(operation.slideId);
      ids.add(operation.elementId);
      const slide = snapshot.slides[operation.slideId];
      const location = slide ? findElementLocationInSlide(slide, operation.elementId) : undefined;
      ids.add(containerId(operation.slideId, location?.parentGroup?.id));
      if (slide) {
        const destinationParent = operation.type === "element.move"
          ? operation.placement.parentGroupId
          : undefined;
        for (const group of groupsPrunedAfterRemoval(slide, operation.elementId, destinationParent)) {
          ids.add(group.id);
          ids.add(groupChildrenContainerId(group.id));
          const groupLocation = findElementLocationInSlide(slide, group.id);
          ids.add(containerId(operation.slideId, groupLocation?.parentGroup?.id));
        }
      }
      if (slide && operation.type === "element.delete") {
        for (const element of collectSubtreeElements(slide, operation.elementId)) {
          addElementIds(element, ids);
        }
      }
      if (operation.type === "element.move") {
        ids.add(containerId(operation.slideId, operation.placement.parentGroupId));
        if (operation.placement.afterElementId) ids.add(operation.placement.afterElementId);
      }
      break;
    }
    case "element.set-locked":
    case "element.set-hidden":
      ids.add(operation.slideId);
      ids.add(operation.elementId);
      break;
    case "shape.set-frame":
    case "shape.set-transform":
    case "shape.set-style":
    case "shape.set-presentation":
    case "text-box.set-presentation":
    case "text.apply":
    case "prompt-content.apply-derived-output":
    case "geometry.set":
    case "line.set":
    case "image.set":
    case "table.set":
    case "chart.set":
      addShapeTarget(operation.slideId, operation.shapeId);
      if (operation.type === "shape.set-style") ids.add(operation.styleId);
      break;
  }
  return [...ids];
};

export const computeTouchedIds = (
  snapshot: DeckSnapshot,
  operations: SlideOperation[]
): string[] => [...new Set(operations.flatMap((operation) => operationIds(snapshot, operation)))].sort();

export const applyOperations = (
  source: DeckSnapshot,
  operations: SlideOperation[],
  richText: RichText,
  limits: SlideLimits
): SlideApplyResult => {
  const snapshot = clone(source);
  let inverse: SlideOperation[] = [];
  const removedInBatch = new Set<string>();
  const addedInBatch = new Set<string>();
  for (const operation of operations) {
    const beforeIdentities = collectSlideIdentities(snapshot);
    const beforeById = new Map(beforeIdentities.map((identity) => [identity.id, identity.kind]));
    const beforeShapeKinds = new Map<string, string>();
    for (const slide of Object.values(snapshot.slides)) {
      for (const element of Object.values(slide.elements)) {
        if (element.elementKind === "shape") beforeShapeKinds.set(element.id, element.shapeKind);
      }
    }
    const stepInverse = applyOne(snapshot, clone(operation), richText);
    const afterIdentities = collectSlideIdentities(snapshot);
    const afterById = new Map(afterIdentities.map((identity) => [identity.id, identity.kind]));
    for (const [id, kind] of beforeById) {
      const afterKind = afterById.get(id);
      if (afterKind !== undefined && afterKind !== kind) {
        throw new SlideOperationError(`Identity kind cannot change in place: ${id}`);
      }
      if (afterKind === undefined) {
        if (addedInBatch.has(id)) throw new SlideOperationError(`Identity cannot be added then removed in one batch: ${id}`);
        removedInBatch.add(id);
      }
    }
    for (const [id] of afterById) {
      if (!beforeById.has(id)) {
        if (removedInBatch.has(id)) throw new SlideOperationError(`Identity cannot be removed then re-added in one batch: ${id}`);
        addedInBatch.add(id);
      }
    }
    for (const slide of Object.values(snapshot.slides)) {
      for (const element of Object.values(slide.elements)) {
        if (element.elementKind !== "shape") continue;
        const beforeKind = beforeShapeKinds.get(element.id);
        if (beforeKind !== undefined && beforeKind !== element.shapeKind) {
          throw new SlideOperationError(`Shape kind cannot change for identity ${element.id}`);
        }
      }
    }
    inverse = [...stepInverse, ...inverse];
  }
  const validation = validateSnapshot(snapshot, richText, limits);
  if (!validation.ok) throw new SlideValidationError(validation.diagnostics);
  return {
    snapshot,
    forward: clone(operations),
    inverse,
    touchedIds: computeTouchedIds(source, operations)
  };
};

export const applyWithoutValidation = (
  source: DeckSnapshot,
  operations: SlideOperation[],
  richText: RichText
): DeckSnapshot => {
  const snapshot = clone(source);
  for (const operation of operations) applyOne(snapshot, clone(operation), richText);
  return snapshot;
};

export const snapshotsEqual = (left: DeckSnapshot, right: DeckSnapshot): boolean =>
  canonicalDigest(left) === canonicalDigest(right);

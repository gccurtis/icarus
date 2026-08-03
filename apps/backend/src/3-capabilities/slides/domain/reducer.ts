import type { RichContent, RichText, TextStyleProperties } from "#rich-text";
import { canonicalDigest } from "./canonical.js";
import {
  allContainers,
  childrenOf,
  descendantsOf,
  findContainer,
  findElement,
  forEachRichContent,
  insertIntoSiblings,
  detachFromSiblings,
  isWithinGroup,
  unreachableElementIds,
  promptSiteKey,
  siblingsOf
} from "./elements.js";
import {
  SlideOperationError,
  SlidePlacementError,
  SlideStyleReferenceError,
  SlideTokenReferenceError,
  SlideValidationError
} from "./errors.js";
import type {
  BoxAppearance,
  DeckSnapshot,
  ElementContainerRef,
  GroupElement,
  Layout,
  Master,
  PromptSite,
  RichContentTarget,
  Slide,
  SlideElement,
  SlideLimits,
  SlideOperation,
  SlideStyle,
  SlideTable,
  SlideTextSource
} from "./model.js";
import { detachedFrameFor } from "./presentation.js";
import { validateSnapshot } from "./validation.js";

export interface FormulaAtomChange {
  target: RichContentTarget;
  atomId: string;
  expression: string;
}

export interface SlideApplyResult {
  snapshot: DeckSnapshot;
  forward: SlideOperation[];
  inverse: SlideOperation[];
  touchedIds: string[];
  formulaChanges: FormulaAtomChange[];
}

const clone = <T>(value: T): T => structuredClone(value);

// ── Lookups that throw ───────────────────────────────────────────────────

const requireContainer = (
  snapshot: DeckSnapshot,
  ref: ElementContainerRef
): Record<string, SlideElement> => {
  const container = findContainer(snapshot, ref);
  if (!container) {
    throw new SlideOperationError(`Element container not found: ${describe(ref)}`);
  }
  return container.elements;
};

const describe = (ref: ElementContainerRef): string =>
  ref.kind === "slide"
    ? `Slide ${ref.slideId}`
    : ref.kind === "master"
      ? `Master ${ref.masterId}`
      : `Layout ${ref.layoutId}`;

const requireElement = (
  snapshot: DeckSnapshot,
  ref: ElementContainerRef,
  elementId: string
): SlideElement => {
  const located = findElement(snapshot, ref, elementId);
  if (!located) {
    throw new SlideOperationError(`Element not found in ${describe(ref)}: ${elementId}`);
  }
  return located.element;
};

const requireSlide = (snapshot: DeckSnapshot, slideId: string): Slide => {
  const slide = snapshot.slides[slideId];
  if (!slide) throw new SlideOperationError(`Slide not found: ${slideId}`);
  return slide;
};

const requireLayout = (snapshot: DeckSnapshot, layoutId: string): Layout => {
  const layout = snapshot.layouts[layoutId];
  if (!layout) throw new SlideOperationError(`Layout not found: ${layoutId}`);
  return layout;
};

const requireMaster = (snapshot: DeckSnapshot, masterId: string): Master => {
  const master = snapshot.masters[masterId];
  if (!master) throw new SlideOperationError(`Master not found: ${masterId}`);
  return master;
};

const requireStyle = (snapshot: DeckSnapshot, styleId: string): SlideStyle => {
  const style = snapshot.styles.styles.find((candidate) => candidate.id === styleId);
  if (!style) throw new SlideStyleReferenceError(styleId);
  return style;
};

const requireTable = (
  snapshot: DeckSnapshot,
  ref: ElementContainerRef,
  elementId: string
) => {
  const element = requireElement(snapshot, ref, elementId);
  if (element.kind !== "table") {
    throw new SlideOperationError(`Element is not a table: ${elementId}`);
  }
  return element.table;
};

/**
 * Resolve a Style through its `basedOnStyleId` chain, nearest ancestor first.
 * Mirrors `resolveDocumentStyle`.
 */
export const resolveSlideStyle = (
  snapshot: DeckSnapshot,
  styleId: string
): { text: TextStyleProperties; box: BoxAppearance } => {
  const chain: SlideStyle[] = [];
  const seen = new Set<string>();
  let current = requireStyle(snapshot, styleId);
  while (true) {
    if (seen.has(current.id)) {
      throw new SlideStyleReferenceError(styleId, "Style inheritance cycle");
    }
    seen.add(current.id);
    chain.unshift(current);
    if (!current.basedOnStyleId) break;
    current = requireStyle(snapshot, current.basedOnStyleId);
  }
  const text: Record<string, unknown> = {};
  const box: Record<string, unknown> = {};
  for (const style of chain) {
    Object.assign(text, style.text ?? {});
    Object.assign(box, style.box ?? {});
  }
  return { text: text as TextStyleProperties, box: box as BoxAppearance };
};

// ── Text sources ─────────────────────────────────────────────────────────

const readTextSource = (
  snapshot: DeckSnapshot,
  site: PromptSite
): SlideTextSource => {
  const element = requireElement(snapshot, site.container, site.elementId);
  if (site.kind === "element-body") {
    if (element.kind !== "text") {
      throw new SlideOperationError(`Element is not a text element: ${site.elementId}`);
    }
    return element.body;
  }
  if (element.kind !== "table") {
    throw new SlideOperationError(`Element is not a table: ${site.elementId}`);
  }
  const cell = element.table.cells.find((candidate) => candidate.id === site.cellId);
  if (!cell) throw new SlideOperationError(`Table cell not found: ${site.cellId}`);
  return cell.body;
};

const writeTextSource = (
  snapshot: DeckSnapshot,
  site: PromptSite,
  source: SlideTextSource
): void => {
  const element = requireElement(snapshot, site.container, site.elementId);
  if (site.kind === "element-body") {
    if (element.kind !== "text") {
      throw new SlideOperationError(`Element is not a text element: ${site.elementId}`);
    }
    element.body = source;
    return;
  }
  if (element.kind !== "table") {
    throw new SlideOperationError(`Element is not a table: ${site.elementId}`);
  }
  const cell = element.table.cells.find((candidate) => candidate.id === site.cellId);
  if (!cell) throw new SlideOperationError(`Table cell not found: ${site.cellId}`);
  cell.body = source;
};

const readRichContent = (
  snapshot: DeckSnapshot,
  target: RichContentTarget
): RichContent => {
  if (target.kind === "slide-notes") return requireSlide(snapshot, target.slideId).notes;
  const element = requireElement(snapshot, target.container, target.elementId);
  if (target.kind === "element-body") {
    if (element.kind !== "text") {
      throw new SlideOperationError(`Element has no body: ${target.elementId}`);
    }
    if (element.body.kind !== "rich") {
      throw new SlideOperationError(`Element body holds a prompt source: ${target.elementId}`);
    }
    return element.body.content;
  }
  if (target.kind === "table-cell") {
    if (element.kind !== "table") {
      throw new SlideOperationError(`Element is not a table: ${target.elementId}`);
    }
    const cell = element.table.cells.find((candidate) => candidate.id === target.cellId);
    if (!cell) throw new SlideOperationError(`Table cell not found: ${target.cellId}`);
    if (cell.body.kind !== "rich") {
      throw new SlideOperationError(`Table cell holds a prompt source: ${target.cellId}`);
    }
    return cell.body.content;
  }
  if (element.kind !== "chart") {
    throw new SlideOperationError(`Element is not a chart: ${target.elementId}`);
  }
  const label = element.chart.labels.find((candidate) => candidate.id === target.labelId);
  if (!label) throw new SlideOperationError(`Chart label not found: ${target.labelId}`);
  return label.content;
};

const writeRichContent = (
  snapshot: DeckSnapshot,
  target: RichContentTarget,
  content: RichContent
): void => {
  if (target.kind === "slide-notes") {
    requireSlide(snapshot, target.slideId).notes = content;
    return;
  }
  const element = requireElement(snapshot, target.container, target.elementId);
  if (target.kind === "element-body" && element.kind === "text") {
    element.body = { kind: "rich", content };
    return;
  }
  if (target.kind === "table-cell" && element.kind === "table") {
    const cell = element.table.cells.find((candidate) => candidate.id === target.cellId);
    if (!cell) throw new SlideOperationError(`Table cell not found: ${target.cellId}`);
    cell.body = { kind: "rich", content };
    return;
  }
  if (target.kind === "chart-label" && element.kind === "chart") {
    const label = element.chart.labels.find((candidate) => candidate.id === target.labelId);
    if (!label) throw new SlideOperationError(`Chart label not found: ${target.labelId}`);
    label.content = content;
    return;
  }
  throw new SlideOperationError(`Rich Content target does not resolve: ${target.kind}`);
};

const snapshotFormulaMap = (
  snapshot: DeckSnapshot
): Map<string, { target: RichContentTarget; expression: string }> => {
  const map = new Map<string, { target: RichContentTarget; expression: string }>();
  forEachRichContent(snapshot, ({ target, content }) => {
    for (const atom of content.atoms) {
      if (atom.kind === "formula") map.set(atom.id, { target, expression: atom.expression });
    }
  });
  return map;
};

// ── Group helpers ────────────────────────────────────────────────────────

/**
 * Reject an element record that is not a well-formed forest.
 *
 * Acyclic group membership is not something the reducer may leave to
 * end-of-batch validation: a cycle makes every downward walk non-terminating,
 * so it has to be unreachable rather than merely rejected. Element-level
 * operations carry their own targeted guards; this covers the operations that
 * accept a whole element record from the caller — `slide.insert`,
 * `master.insert` and `layout.insert` — where there is nothing to guard
 * incrementally.
 */
const assertElementForest = (
  elements: Record<string, SlideElement>,
  where: string
): void => {
  for (const [elementId, element] of Object.entries(elements)) {
    if (element.id !== elementId) {
      throw new SlideOperationError(
        `${where} element ${elementId} is keyed by a different ID than it carries`
      );
    }
    if (element.parentGroupId === undefined) continue;
    const parent = elements[element.parentGroupId];
    if (!parent) {
      throw new SlideOperationError(
        `${where} element ${elementId} references missing group ${element.parentGroupId}`
      );
    }
    if (parent.kind !== "group") {
      throw new SlideOperationError(
        `${where} element ${elementId} names a non-group parent ${element.parentGroupId}`
      );
    }
  }
  const unreachable = unreachableElementIds(elements);
  if (unreachable.length > 0) {
    throw new SlideOperationError(
      `${where} contains a group cycle: ${unreachable.join(", ")}`
    );
  }
};

/** Delete an element and, when it is a Group, everything beneath it. */
const removeElementTree = (
  elements: Record<string, SlideElement>,
  element: SlideElement
): void => {
  if (element.kind === "group") {
    for (const descendant of descendantsOf(elements, element.id)) {
      delete elements[descendant.id];
    }
  }
  detachFromSiblings(elements, element);
};

// ── Forward application ──────────────────────────────────────────────────

const applyOne = (
  snapshot: DeckSnapshot,
  operation: SlideOperation,
  richText: RichText
): void => {
  switch (operation.type) {
    case "deck.rename":
      snapshot.title = operation.title;
      return;
    case "deck.set-lifecycle":
      snapshot.lifecycle = operation.lifecycle;
      return;
    case "canvas.set":
      snapshot.canvas = clone(operation.canvas);
      return;
    case "theme.rename":
      snapshot.theme.name = operation.name;
      return;
    case "theme.set-palette":
      snapshot.theme.palette = clone(operation.palette);
      return;
    case "theme.set-typography":
      snapshot.theme.typography = clone(operation.typography);
      return;
    case "token.create":
      if (snapshot.theme.tokens[operation.token.id]) {
        throw new SlideOperationError(`Design Token already exists: ${operation.token.id}`);
      }
      snapshot.theme.tokens[operation.token.id] = clone(operation.token);
      return;
    case "token.update": {
      if (!snapshot.theme.tokens[operation.tokenId]) {
        throw new SlideTokenReferenceError(operation.tokenId);
      }
      if (operation.token.id !== operation.tokenId) {
        throw new SlideOperationError("token.update cannot change identity");
      }
      snapshot.theme.tokens[operation.tokenId] = clone(operation.token);
      return;
    }
    case "token.delete": {
      const token = snapshot.theme.tokens[operation.tokenId];
      if (!token) throw new SlideTokenReferenceError(operation.tokenId);
      const replacement = snapshot.theme.tokens[operation.replacementTokenId];
      if (!replacement) throw new SlideTokenReferenceError(operation.replacementTokenId);
      if (replacement.kind !== token.kind) {
        throw new SlideTokenReferenceError(
          operation.replacementTokenId,
          `Replacement token must be of kind ${token.kind}`
        );
      }
      delete snapshot.theme.tokens[operation.tokenId];
      retargetTokenReferences(snapshot, operation.tokenId, operation.replacementTokenId);
      return;
    }
    case "style.create":
      if (snapshot.styles.styles.some((style) => style.id === operation.style.id)) {
        throw new SlideOperationError(`Style already exists: ${operation.style.id}`);
      }
      snapshot.styles.styles.push(clone(operation.style));
      return;
    case "style.update": {
      const index = snapshot.styles.styles.findIndex((style) => style.id === operation.styleId);
      if (index < 0) throw new SlideStyleReferenceError(operation.styleId);
      if (operation.style.id !== operation.styleId) {
        throw new SlideOperationError("style.update cannot change identity");
      }
      snapshot.styles.styles[index] = clone(operation.style);
      return;
    }
    case "style.delete": {
      const index = snapshot.styles.styles.findIndex((style) => style.id === operation.styleId);
      if (index < 0) throw new SlideStyleReferenceError(operation.styleId);
      requireStyle(snapshot, operation.replacementStyleId);
      if (operation.replacementStyleId === operation.styleId) {
        throw new SlideOperationError("A Style cannot replace itself");
      }
      snapshot.styles.styles.splice(index, 1);
      retargetStyleReferences(snapshot, operation.styleId, operation.replacementStyleId);
      return;
    }
    case "style.set-default":
      requireStyle(snapshot, operation.styleId);
      snapshot.styles.defaultStyleIdByElementKind[operation.elementKind] = operation.styleId;
      return;
    case "master.insert":
      if (snapshot.masters[operation.master.id]) {
        throw new SlideOperationError(`Master already exists: ${operation.master.id}`);
      }
      assertElementForest(operation.master.elements, `Master ${operation.master.id}`);
      snapshot.masters[operation.master.id] = clone(operation.master);
      return;
    case "master.rename":
      requireMaster(snapshot, operation.masterId).name = operation.name;
      return;
    case "master.set-background":
      requireMaster(snapshot, operation.masterId).background = clone(operation.background);
      return;
    case "master.delete": {
      requireMaster(snapshot, operation.masterId);
      requireMaster(snapshot, operation.replacementMasterId);
      if (operation.replacementMasterId === operation.masterId) {
        throw new SlideOperationError("A Master cannot replace itself");
      }
      delete snapshot.masters[operation.masterId];
      for (const layout of Object.values(snapshot.layouts)) {
        if (layout.masterId === operation.masterId) layout.masterId = operation.replacementMasterId;
      }
      return;
    }
    case "layout.insert":
      if (snapshot.layouts[operation.layout.id]) {
        throw new SlideOperationError(`Layout already exists: ${operation.layout.id}`);
      }
      requireMaster(snapshot, operation.layout.masterId);
      assertElementForest(operation.layout.elements, `Layout ${operation.layout.id}`);
      snapshot.layouts[operation.layout.id] = clone(operation.layout);
      return;
    case "layout.rename":
      requireLayout(snapshot, operation.layoutId).name = operation.name;
      return;
    case "layout.set-master":
      requireMaster(snapshot, operation.masterId);
      requireLayout(snapshot, operation.layoutId).masterId = operation.masterId;
      return;
    case "layout.set-background": {
      const layout = requireLayout(snapshot, operation.layoutId);
      if (operation.background === undefined) delete layout.background;
      else layout.background = clone(operation.background);
      return;
    }
    case "layout.delete": {
      requireLayout(snapshot, operation.layoutId);
      requireLayout(snapshot, operation.replacementLayoutId);
      if (operation.replacementLayoutId === operation.layoutId) {
        throw new SlideOperationError("A Layout cannot replace itself");
      }
      delete snapshot.layouts[operation.layoutId];
      for (const slide of Object.values(snapshot.slides)) {
        if (slide.layoutId === operation.layoutId) slide.layoutId = operation.replacementLayoutId;
      }
      return;
    }
    case "slot.insert": {
      const layout = requireLayout(snapshot, operation.layoutId);
      if (layout.slots[operation.slot.id]) {
        throw new SlideOperationError(`Slot already exists: ${operation.slot.id}`);
      }
      layout.slots[operation.slot.id] = clone(operation.slot);
      return;
    }
    case "slot.update": {
      const layout = requireLayout(snapshot, operation.layoutId);
      if (!layout.slots[operation.slot.id]) {
        throw new SlideOperationError(`Slot not found: ${operation.slot.id}`);
      }
      layout.slots[operation.slot.id] = clone(operation.slot);
      return;
    }
    case "slot.delete": {
      const layout = requireLayout(snapshot, operation.layoutId);
      if (!layout.slots[operation.slotId]) {
        throw new SlideOperationError(`Slot not found: ${operation.slotId}`);
      }
      // Elements bound to the slot are left bound. The binding becomes dangling
      // and a projection reports it; making deletion cascade into Slides would
      // turn a Layout edit into an unbounded Slide rewrite.
      delete layout.slots[operation.slotId];
      return;
    }
    case "slide.insert": {
      if (snapshot.slides[operation.slide.id]) {
        throw new SlideOperationError(`Slide already exists: ${operation.slide.id}`);
      }
      requireLayout(snapshot, operation.slide.layoutId);
      const index = operation.afterSlideId
        ? snapshot.slideOrder.indexOf(operation.afterSlideId) + 1
        : 0;
      if (operation.afterSlideId && index === 0) {
        throw new SlidePlacementError(`Anchor Slide not found: ${operation.afterSlideId}`);
      }
      assertElementForest(operation.slide.elements, `Slide ${operation.slide.id}`);
      snapshot.slides[operation.slide.id] = clone(operation.slide);
      snapshot.slideOrder.splice(index, 0, operation.slide.id);
      return;
    }
    case "slide.move": {
      const from = snapshot.slideOrder.indexOf(operation.slideId);
      if (from < 0) throw new SlideOperationError(`Slide not found: ${operation.slideId}`);
      if (operation.afterSlideId === operation.slideId) {
        throw new SlidePlacementError("A Slide cannot move after itself");
      }
      snapshot.slideOrder.splice(from, 1);
      const index = operation.afterSlideId
        ? snapshot.slideOrder.indexOf(operation.afterSlideId) + 1
        : 0;
      if (operation.afterSlideId && index === 0) {
        throw new SlidePlacementError(`Anchor Slide not found: ${operation.afterSlideId}`);
      }
      snapshot.slideOrder.splice(index, 0, operation.slideId);
      return;
    }
    case "slide.delete": {
      const index = snapshot.slideOrder.indexOf(operation.slideId);
      if (index < 0) throw new SlideOperationError(`Slide not found: ${operation.slideId}`);
      snapshot.slideOrder.splice(index, 1);
      delete snapshot.slides[operation.slideId];
      return;
    }
    case "slide.set-layout":
      requireLayout(snapshot, operation.layoutId);
      requireSlide(snapshot, operation.slideId).layoutId = operation.layoutId;
      return;
    case "slide.set-title": {
      const slide = requireSlide(snapshot, operation.slideId);
      if (operation.title === undefined) delete slide.title;
      else slide.title = operation.title;
      return;
    }
    case "slide.set-background": {
      const slide = requireSlide(snapshot, operation.slideId);
      if (operation.background === undefined) delete slide.background;
      else slide.background = clone(operation.background);
      return;
    }
    case "element.insert": {
      const elements = requireContainer(snapshot, operation.container);
      if (elements[operation.element.id]) {
        throw new SlideOperationError(`Element already exists: ${operation.element.id}`);
      }
      const element = clone(operation.element);
      const parentGroupId = element.parentGroupId;
      if (parentGroupId !== undefined) {
        const parent = elements[parentGroupId];
        if (!parent || parent.kind !== "group") {
          throw new SlideOperationError(`Parent group not found: ${parentGroupId}`);
        }
      }
      orderElementTables(element);
      insertIntoSiblings(elements, element, parentGroupId, element.zIndex);
      return;
    }
    case "element.replace": {
      const elements = requireContainer(snapshot, operation.container);
      const existing = elements[operation.element.id];
      if (!existing) {
        throw new SlideOperationError(`Element not found: ${operation.element.id}`);
      }
      if (existing.kind === "group" && operation.element.kind !== "group") {
        throw new SlideOperationError("element.replace cannot turn a Group into another kind");
      }
      // Position is structural and is never carried by a replacement: it stays
      // exactly where it was, so replace is purely a content edit.
      const replacement = clone(operation.element);
      replacement.zIndex = existing.zIndex;
      if (existing.parentGroupId === undefined) delete replacement.parentGroupId;
      else replacement.parentGroupId = existing.parentGroupId;
      orderElementTables(replacement);
      elements[operation.element.id] = replacement;
      return;
    }
    case "element.reorder": {
      const elements = requireContainer(snapshot, operation.container);
      const element = requireElement(snapshot, operation.container, operation.elementId);
      const parentGroupId = operation.parentGroupId;
      if (parentGroupId !== undefined) {
        const parent = elements[parentGroupId];
        if (!parent || parent.kind !== "group") {
          throw new SlideOperationError(`Parent group not found: ${parentGroupId}`);
        }
        if (isWithinGroup(elements, parentGroupId, operation.elementId)) {
          throw new SlideOperationError("An element cannot be moved beneath itself");
        }
      }
      detachFromSiblings(elements, element);
      insertIntoSiblings(elements, element, parentGroupId, operation.zIndex);
      return;
    }
    case "element.delete": {
      const elements = requireContainer(snapshot, operation.container);
      const element = requireElement(snapshot, operation.container, operation.elementId);
      removeElementTree(elements, element);
      return;
    }
    case "element.set-placement": {
      const element = requireElement(snapshot, operation.container, operation.elementId);
      if (operation.placement.kind === "slot" && operation.container.kind !== "slide") {
        throw new SlidePlacementError("Only a Slide element may bind a slot");
      }
      element.placement = clone(operation.placement);
      return;
    }
    case "element.set-style": {
      const element = requireElement(snapshot, operation.container, operation.elementId);
      if (operation.styleId === undefined) delete element.styleId;
      else {
        requireStyle(snapshot, operation.styleId);
        element.styleId = operation.styleId;
      }
      return;
    }
    case "element.set-rotation": {
      const element = requireElement(snapshot, operation.container, operation.elementId);
      if (operation.rotationDegrees === undefined) delete element.rotationDegrees;
      else element.rotationDegrees = operation.rotationDegrees;
      return;
    }
    case "element.set-flags": {
      const element = requireElement(snapshot, operation.container, operation.elementId);
      element.locked = operation.locked;
      element.hidden = operation.hidden;
      return;
    }
    case "element.group": {
      const elements = requireContainer(snapshot, operation.container);
      if (elements[operation.group.id]) {
        throw new SlideOperationError(`Element already exists: ${operation.group.id}`);
      }
      if (operation.memberIds.length === 0) {
        throw new SlideOperationError("A Group must be created with at least one member");
      }
      if (new Set(operation.memberIds).size !== operation.memberIds.length) {
        throw new SlideOperationError("A Group may not name the same member twice");
      }
      const members = operation.memberIds.map((id) => {
        const member = elements[id];
        if (!member) throw new SlideOperationError(`Group member not found: ${id}`);
        return member;
      });
      // Sharing one parent is what makes grouping incapable of producing a
      // cycle: a member that already contained another member would sit at a
      // different depth, so it cannot pass this check.
      const parentGroupId = members[0].parentGroupId;
      for (const member of members) {
        if (member.parentGroupId !== parentGroupId) {
          throw new SlideOperationError("Group members must share one parent");
        }
      }
      // The Group takes the position of its lowest member, so grouping does not
      // change what is in front of what.
      const ordered = [...members].sort((left, right) => left.zIndex - right.zIndex);
      const lowest = ordered[0].zIndex;
      const memberIds = new Set(ordered.map((member) => member.id));
      const remaining = siblingsOf(elements, parentGroupId).filter(
        (sibling) => !memberIds.has(sibling.id)
      );
      const groupIndex = remaining.filter((sibling) => sibling.zIndex < lowest).length;

      for (const member of ordered) delete elements[member.id];
      for (let index = 0; index < remaining.length; index += 1) remaining[index].zIndex = index;

      const group = clone(operation.group);
      insertIntoSiblings(elements, group, parentGroupId, groupIndex);
      for (let index = 0; index < ordered.length; index += 1) {
        const member = ordered[index];
        member.parentGroupId = group.id;
        member.zIndex = index;
        elements[member.id] = member;
      }
      return;
    }
    case "element.ungroup": {
      const elements = requireContainer(snapshot, operation.container);
      const group = elements[operation.groupId];
      if (!group) throw new SlideOperationError(`Group not found: ${operation.groupId}`);
      if (group.kind !== "group") {
        throw new SlideOperationError(`Element is not a Group: ${operation.groupId}`);
      }
      const members = childrenOf(elements, group.id);
      const parentGroupId = group.parentGroupId;
      const groupIndex = group.zIndex;

      detachFromSiblings(elements, group);
      // Members land where the Group was, in their relative order.
      for (const sibling of siblingsOf(elements, parentGroupId)) {
        if (sibling.zIndex >= groupIndex) sibling.zIndex += members.length;
      }
      for (let index = 0; index < members.length; index += 1) {
        const member = members[index];
        if (parentGroupId === undefined) delete member.parentGroupId;
        else member.parentGroupId = parentGroupId;
        member.zIndex = groupIndex + index;
      }
      return;
    }
    case "text-source.set":
      writeTextSource(snapshot, operation.target, clone(operation.source));
      return;
    case "rich-text.apply": {
      const content = readRichContent(snapshot, operation.target);
      const result = richText.apply(content, operation.operations);
      writeRichContent(snapshot, operation.target, result.content);
      return;
    }
    case "prompt.apply-derived-output": {
      const existing = readTextSource(snapshot, operation.site);
      if (existing.kind !== "prompt") {
        throw new SlideOperationError("Only a prompt source can take a Derived Output revision");
      }
      writeTextSource(snapshot, operation.site, {
        kind: "prompt",
        output: clone(operation.output)
      });
      return;
    }
    case "table.insert-row": {
      const table = requireTable(snapshot, operation.container, operation.elementId);
      if (table.rows.some((row) => row.id === operation.row.id)) {
        throw new SlideOperationError(`Table row already exists: ${operation.row.id}`);
      }
      const index = operation.afterRowId
        ? table.rows.findIndex((row) => row.id === operation.afterRowId) + 1
        : 0;
      if (operation.afterRowId && index === 0) {
        throw new SlidePlacementError(`Anchor table row not found: ${operation.afterRowId}`);
      }
      table.rows.splice(index, 0, clone(operation.row));
      table.cells.push(...clone(operation.cells));
      orderTableCells(table);
      return;
    }
    case "table.move-row": {
      const table = requireTable(snapshot, operation.container, operation.elementId);
      const from = table.rows.findIndex((row) => row.id === operation.rowId);
      if (from < 0) throw new SlideOperationError(`Table row not found: ${operation.rowId}`);
      if (operation.afterRowId === operation.rowId) {
        throw new SlidePlacementError("A table row cannot move after itself");
      }
      const [row] = table.rows.splice(from, 1);
      const index = operation.afterRowId
        ? table.rows.findIndex((candidate) => candidate.id === operation.afterRowId) + 1
        : 0;
      if (operation.afterRowId && index === 0) {
        throw new SlidePlacementError(`Anchor table row not found: ${operation.afterRowId}`);
      }
      table.rows.splice(index, 0, row);
      orderTableCells(table);
      return;
    }
    case "table.delete-row": {
      const table = requireTable(snapshot, operation.container, operation.elementId);
      const index = table.rows.findIndex((row) => row.id === operation.rowId);
      if (index < 0) throw new SlideOperationError(`Table row not found: ${operation.rowId}`);
      table.rows.splice(index, 1);
      const removed = new Set(
        table.cells.filter((cell) => cell.rowId === operation.rowId).map((cell) => cell.id)
      );
      table.cells = table.cells.filter((cell) => !removed.has(cell.id));
      table.merges = pruneMerges(table.merges, removed);
      orderTableCells(table);
      return;
    }
    case "table.insert-column": {
      const table = requireTable(snapshot, operation.container, operation.elementId);
      if (table.columns.some((column) => column.id === operation.column.id)) {
        throw new SlideOperationError(`Table column already exists: ${operation.column.id}`);
      }
      const index = operation.afterColumnId
        ? table.columns.findIndex((column) => column.id === operation.afterColumnId) + 1
        : 0;
      if (operation.afterColumnId && index === 0) {
        throw new SlidePlacementError(`Anchor table column not found: ${operation.afterColumnId}`);
      }
      table.columns.splice(index, 0, clone(operation.column));
      table.cells.push(...clone(operation.cells));
      orderTableCells(table);
      return;
    }
    case "table.move-column": {
      const table = requireTable(snapshot, operation.container, operation.elementId);
      const from = table.columns.findIndex((column) => column.id === operation.columnId);
      if (from < 0) throw new SlideOperationError(`Table column not found: ${operation.columnId}`);
      if (operation.afterColumnId === operation.columnId) {
        throw new SlidePlacementError("A table column cannot move after itself");
      }
      const [column] = table.columns.splice(from, 1);
      const index = operation.afterColumnId
        ? table.columns.findIndex((candidate) => candidate.id === operation.afterColumnId) + 1
        : 0;
      if (operation.afterColumnId && index === 0) {
        throw new SlidePlacementError(`Anchor table column not found: ${operation.afterColumnId}`);
      }
      table.columns.splice(index, 0, column);
      orderTableCells(table);
      return;
    }
    case "table.delete-column": {
      const table = requireTable(snapshot, operation.container, operation.elementId);
      const index = table.columns.findIndex((column) => column.id === operation.columnId);
      if (index < 0) throw new SlideOperationError(`Table column not found: ${operation.columnId}`);
      table.columns.splice(index, 1);
      const removed = new Set(
        table.cells.filter((cell) => cell.columnId === operation.columnId).map((cell) => cell.id)
      );
      table.cells = table.cells.filter((cell) => !removed.has(cell.id));
      table.merges = pruneMerges(table.merges, removed);
      orderTableCells(table);
      return;
    }
    case "table.merge": {
      const table = requireTable(snapshot, operation.container, operation.elementId);
      if (table.merges.some((merge) => merge.id === operation.merge.id)) {
        throw new SlideOperationError(`Table merge already exists: ${operation.merge.id}`);
      }
      table.merges.push(clone(operation.merge));
      return;
    }
    case "table.unmerge": {
      const table = requireTable(snapshot, operation.container, operation.elementId);
      const index = table.merges.findIndex((merge) => merge.id === operation.mergeId);
      if (index < 0) throw new SlideOperationError(`Table merge not found: ${operation.mergeId}`);
      table.merges.splice(index, 1);
      return;
    }
    case "image.set-source": {
      const element = requireElement(snapshot, operation.container, operation.elementId);
      if (element.kind !== "image") {
        throw new SlideOperationError(`Element is not an image: ${operation.elementId}`);
      }
      element.image.source = clone(operation.source);
      return;
    }
    case "image.set-accessibility": {
      const element = requireElement(snapshot, operation.container, operation.elementId);
      if (element.kind !== "image") {
        throw new SlideOperationError(`Element is not an image: ${operation.elementId}`);
      }
      element.image.alt = operation.alt;
      element.image.decorative = operation.decorative;
      return;
    }
  }
};

/**
 * A table is dense, so the cell array carries no information the row and column
 * orders do not already hold. Ordering it row-major after every structural edit
 * makes the array derived rather than authored — without this, restoring a
 * deleted column appends its cells and the round trip changes canonical bytes
 * while the table is logically unchanged.
 */
const orderTableCells = (table: SlideTable): void => {
  const rowIndex = new Map(table.rows.map((row, index) => [row.id, index]));
  const columnIndex = new Map(table.columns.map((column, index) => [column.id, index]));
  const rank = (id: string, index: Map<string, number>): number =>
    index.get(id) ?? Number.MAX_SAFE_INTEGER;
  table.cells.sort((left, right) => {
    const byRow = rank(left.rowId, rowIndex) - rank(right.rowId, rowIndex);
    if (byRow !== 0) return byRow;
    const byColumn = rank(left.columnId, columnIndex) - rank(right.columnId, columnIndex);
    if (byColumn !== 0) return byColumn;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
};

const orderElementTables = (element: SlideElement): void => {
  if (element.kind === "table") orderTableCells(element.table);
};

const pruneMerges = (
  merges: { id: string; rootCellId: string; coveredCellIds: string[] }[],
  removedCellIds: Set<string>
) =>
  merges
    .filter((merge) => !removedCellIds.has(merge.rootCellId))
    .map((merge) => ({
      ...merge,
      coveredCellIds: merge.coveredCellIds.filter((id) => !removedCellIds.has(id))
    }))
    .filter((merge) => merge.coveredCellIds.length > 0);

const retargetStyleReferences = (
  snapshot: DeckSnapshot,
  styleId: string,
  replacementStyleId: string
): void => {
  for (const kind of Object.keys(
    snapshot.styles.defaultStyleIdByElementKind
  ) as (keyof typeof snapshot.styles.defaultStyleIdByElementKind)[]) {
    if (snapshot.styles.defaultStyleIdByElementKind[kind] === styleId) {
      snapshot.styles.defaultStyleIdByElementKind[kind] = replacementStyleId;
    }
  }
  for (const style of snapshot.styles.styles) {
    if (style.basedOnStyleId === styleId) style.basedOnStyleId = replacementStyleId;
  }
  for (const container of allContainers(snapshot)) {
    for (const element of Object.values(container.elements)) {
      if (element.styleId === styleId) element.styleId = replacementStyleId;
      if (element.kind !== "table") continue;
      for (const cell of element.table.cells) {
        if (cell.styleId === styleId) cell.styleId = replacementStyleId;
      }
    }
  }
};

const retargetTokenReferences = (
  snapshot: DeckSnapshot,
  tokenId: string,
  replacementTokenId: string
): void => {
  const retarget = (value: { kind: string; tokenId?: string }): void => {
    if (value.kind === "token" && value.tokenId === tokenId) {
      value.tokenId = replacementTokenId;
    }
  };
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (typeof record.kind === "string" && typeof record.tokenId === "string") {
      retarget(record as { kind: string; tokenId?: string });
    }
    for (const key of Object.keys(record)) {
      if (key === "tokens") continue;
      walk(record[key]);
    }
  };
  walk(snapshot.theme.palette);
  walk(snapshot.theme.typography);
  walk(snapshot.styles);
  walk(snapshot.masters);
  walk(snapshot.layouts);
  walk(snapshot.slides);
};

// ── Inverses ─────────────────────────────────────────────────────────────

const previousId = <T>(items: T[], index: number, id: (item: T) => string): string | undefined =>
  index > 0 ? id(items[index - 1]) : undefined;

/**
 * Restore an element exactly where it was, including its parent and z-index.
 * Groups restore their whole subtree, deepest last, so every member's parent
 * exists before the member is written.
 */
const restoreElementTree = (
  container: ElementContainerRef,
  elements: Record<string, SlideElement>,
  element: SlideElement
): SlideOperation[] => {
  const operations: SlideOperation[] = [
    { type: "element.insert", container, element: clone(element) }
  ];
  if (element.kind === "group") {
    for (const descendant of descendantsOf(elements, element.id)) {
      operations.push({ type: "element.insert", container, element: clone(descendant) });
    }
  }
  return operations;
};

const inverseFor = (
  before: DeckSnapshot,
  operation: SlideOperation,
  after: DeckSnapshot,
  richText: RichText
): SlideOperation[] => {
  switch (operation.type) {
    case "deck.rename":
      return [{ type: "deck.rename", title: before.title }];
    case "deck.set-lifecycle":
      return [{ type: "deck.set-lifecycle", lifecycle: before.lifecycle }];
    case "canvas.set":
      return [{ type: "canvas.set", canvas: clone(before.canvas) }];
    case "theme.rename":
      return [{ type: "theme.rename", name: before.theme.name }];
    case "theme.set-palette":
      return [{ type: "theme.set-palette", palette: clone(before.theme.palette) }];
    case "theme.set-typography":
      return [{ type: "theme.set-typography", typography: clone(before.theme.typography) }];
    case "token.create":
      return [
        {
          type: "token.delete",
          tokenId: operation.token.id,
          replacementTokenId: firstTokenOfKind(before, operation.token.kind, operation.token.id)
        }
      ];
    case "token.update":
      return [
        {
          type: "token.update",
          tokenId: operation.tokenId,
          token: clone(before.theme.tokens[operation.tokenId])
        }
      ];
    case "token.delete": {
      const token = before.theme.tokens[operation.tokenId];
      return [
        { type: "token.create", token: clone(token) },
        ...retargetInverse(before, after)
      ];
    }
    case "style.create":
      return [
        {
          type: "style.delete",
          styleId: operation.style.id,
          replacementStyleId: fallbackStyleId(before, operation.style.id)
        }
      ];
    case "style.update":
      return [
        {
          type: "style.update",
          styleId: operation.styleId,
          style: clone(requireStyle(before, operation.styleId))
        }
      ];
    case "style.delete": {
      const index = before.styles.styles.findIndex((style) => style.id === operation.styleId);
      const style = before.styles.styles[index];
      return [
        { type: "style.create", style: clone(style) },
        ...styleOrderRestore(before, index),
        ...retargetInverse(before, after)
      ];
    }
    case "style.set-default":
      return [
        {
          type: "style.set-default",
          elementKind: operation.elementKind,
          styleId: before.styles.defaultStyleIdByElementKind[operation.elementKind]
        }
      ];
    case "master.insert":
      return [
        {
          type: "master.delete",
          masterId: operation.master.id,
          replacementMasterId: anyOtherMasterId(before, operation.master.id)
        }
      ];
    case "master.rename":
      return [
        {
          type: "master.rename",
          masterId: operation.masterId,
          name: before.masters[operation.masterId].name
        }
      ];
    case "master.set-background":
      return [
        {
          type: "master.set-background",
          masterId: operation.masterId,
          background: clone(before.masters[operation.masterId].background)
        }
      ];
    case "master.delete": {
      const master = before.masters[operation.masterId];
      const reassigned = Object.values(before.layouts)
        .filter((layout) => layout.masterId === operation.masterId)
        .map((layout): SlideOperation => ({
          type: "layout.set-master",
          layoutId: layout.id,
          masterId: operation.masterId
        }));
      return [{ type: "master.insert", master: clone(master) }, ...reassigned];
    }
    case "layout.insert":
      return [
        {
          type: "layout.delete",
          layoutId: operation.layout.id,
          replacementLayoutId: anyOtherLayoutId(before, operation.layout.id)
        }
      ];
    case "layout.rename":
      return [
        {
          type: "layout.rename",
          layoutId: operation.layoutId,
          name: before.layouts[operation.layoutId].name
        }
      ];
    case "layout.set-master":
      return [
        {
          type: "layout.set-master",
          layoutId: operation.layoutId,
          masterId: before.layouts[operation.layoutId].masterId
        }
      ];
    case "layout.set-background": {
      const background = before.layouts[operation.layoutId].background;
      return [
        background === undefined
          ? { type: "layout.set-background", layoutId: operation.layoutId }
          : {
              type: "layout.set-background",
              layoutId: operation.layoutId,
              background: clone(background)
            }
      ];
    }
    case "layout.delete": {
      const layout = before.layouts[operation.layoutId];
      const reassigned = Object.values(before.slides)
        .filter((slide) => slide.layoutId === operation.layoutId)
        .map((slide): SlideOperation => ({
          type: "slide.set-layout",
          slideId: slide.id,
          layoutId: operation.layoutId
        }));
      return [{ type: "layout.insert", layout: clone(layout) }, ...reassigned];
    }
    case "slot.insert":
      return [
        { type: "slot.delete", layoutId: operation.layoutId, slotId: operation.slot.id }
      ];
    case "slot.update":
      return [
        {
          type: "slot.update",
          layoutId: operation.layoutId,
          slot: clone(before.layouts[operation.layoutId].slots[operation.slot.id])
        }
      ];
    case "slot.delete":
      return [
        {
          type: "slot.insert",
          layoutId: operation.layoutId,
          slot: clone(before.layouts[operation.layoutId].slots[operation.slotId])
        }
      ];
    case "slide.insert":
      return [{ type: "slide.delete", slideId: operation.slide.id }];
    case "slide.move": {
      const index = before.slideOrder.indexOf(operation.slideId);
      return [
        {
          type: "slide.move",
          slideId: operation.slideId,
          ...withAfter(previousId(before.slideOrder, index, (id) => id))
        }
      ];
    }
    case "slide.delete": {
      const index = before.slideOrder.indexOf(operation.slideId);
      return [
        {
          type: "slide.insert",
          slide: clone(before.slides[operation.slideId]),
          ...withAfter(previousId(before.slideOrder, index, (id) => id))
        }
      ];
    }
    case "slide.set-layout":
      return [
        {
          type: "slide.set-layout",
          slideId: operation.slideId,
          layoutId: before.slides[operation.slideId].layoutId
        }
      ];
    case "slide.set-title": {
      const title = before.slides[operation.slideId].title;
      return [
        title === undefined
          ? { type: "slide.set-title", slideId: operation.slideId }
          : { type: "slide.set-title", slideId: operation.slideId, title }
      ];
    }
    case "slide.set-background": {
      const background = before.slides[operation.slideId].background;
      return [
        background === undefined
          ? { type: "slide.set-background", slideId: operation.slideId }
          : {
              type: "slide.set-background",
              slideId: operation.slideId,
              background: clone(background)
            }
      ];
    }
    case "element.insert":
      return [
        {
          type: "element.delete",
          container: operation.container,
          elementId: operation.element.id
        }
      ];
    case "element.replace": {
      const existing = requireElement(before, operation.container, operation.element.id);
      return [
        { type: "element.replace", container: operation.container, element: clone(existing) }
      ];
    }
    case "element.reorder": {
      const element = requireElement(before, operation.container, operation.elementId);
      return [
        {
          type: "element.reorder",
          container: operation.container,
          elementId: operation.elementId,
          ...(element.parentGroupId === undefined
            ? {}
            : { parentGroupId: element.parentGroupId }),
          zIndex: element.zIndex
        }
      ];
    }
    case "element.delete": {
      const elements = requireContainer(before, operation.container);
      const element = requireElement(before, operation.container, operation.elementId);
      return restoreElementTree(operation.container, elements, element);
    }
    case "element.set-placement": {
      const element = requireElement(before, operation.container, operation.elementId);
      return [
        {
          type: "element.set-placement",
          container: operation.container,
          elementId: operation.elementId,
          placement: clone(element.placement)
        }
      ];
    }
    case "element.set-style": {
      const element = requireElement(before, operation.container, operation.elementId);
      return [
        element.styleId === undefined
          ? {
              type: "element.set-style",
              container: operation.container,
              elementId: operation.elementId
            }
          : {
              type: "element.set-style",
              container: operation.container,
              elementId: operation.elementId,
              styleId: element.styleId
            }
      ];
    }
    case "element.set-rotation": {
      const element = requireElement(before, operation.container, operation.elementId);
      return [
        element.rotationDegrees === undefined
          ? {
              type: "element.set-rotation",
              container: operation.container,
              elementId: operation.elementId
            }
          : {
              type: "element.set-rotation",
              container: operation.container,
              elementId: operation.elementId,
              rotationDegrees: element.rotationDegrees
            }
      ];
    }
    case "element.set-flags": {
      const element = requireElement(before, operation.container, operation.elementId);
      return [
        {
          type: "element.set-flags",
          container: operation.container,
          elementId: operation.elementId,
          locked: element.locked,
          hidden: element.hidden
        }
      ];
    }
    case "element.group": {
      // Ungrouping returns the members to the parent as a contiguous run, which
      // is not where they were if non-members were interleaved. The explicit
      // reorders restore each member's original index; applying them in
      // ascending index order reconstructs the original arrangement exactly.
      const elements = requireContainer(before, operation.container);
      const restored = operation.memberIds
        .map((id) => elements[id])
        .sort((left, right) => left.zIndex - right.zIndex)
        .map((member): SlideOperation => ({
          type: "element.reorder",
          container: operation.container,
          elementId: member.id,
          ...(member.parentGroupId === undefined
            ? {}
            : { parentGroupId: member.parentGroupId }),
          zIndex: member.zIndex
        }));
      return [
        { type: "element.ungroup", container: operation.container, groupId: operation.group.id },
        ...restored
      ];
    }
    case "element.ungroup": {
      const elements = requireContainer(before, operation.container);
      const group = elements[operation.groupId] as GroupElement;
      const members = childrenOf(elements, operation.groupId);
      return [
        {
          type: "element.group",
          container: operation.container,
          group: clone(group),
          memberIds: members.map((member) => member.id)
        },
        {
          type: "element.reorder",
          container: operation.container,
          elementId: operation.groupId,
          ...(group.parentGroupId === undefined
            ? {}
            : { parentGroupId: group.parentGroupId }),
          zIndex: group.zIndex
        }
      ];
    }
    case "text-source.set":
      return [
        {
          type: "text-source.set",
          target: operation.target,
          source: clone(readTextSource(before, operation.target))
        }
      ];
    case "rich-text.apply": {
      const content = readRichContent(before, operation.target);
      const result = richText.apply(content, operation.operations);
      return [
        {
          type: "rich-text.apply",
          target: operation.target,
          operations: clone(result.inverse)
        }
      ];
    }
    case "prompt.apply-derived-output": {
      const existing = readTextSource(before, operation.site);
      if (existing.kind !== "prompt") {
        throw new SlideOperationError("Only a prompt source can take a Derived Output revision");
      }
      return [
        {
          type: "prompt.apply-derived-output",
          site: operation.site,
          output: clone(existing.output)
        }
      ];
    }
    case "table.insert-row":
      return [
        {
          type: "table.delete-row",
          container: operation.container,
          elementId: operation.elementId,
          rowId: operation.row.id
        }
      ];
    case "table.move-row": {
      const table = requireTable(before, operation.container, operation.elementId);
      const index = table.rows.findIndex((row) => row.id === operation.rowId);
      return [
        {
          type: "table.move-row",
          container: operation.container,
          elementId: operation.elementId,
          rowId: operation.rowId,
          ...withAfterRow(previousId(table.rows, index, (row) => row.id))
        }
      ];
    }
    case "table.delete-row": {
      const table = requireTable(before, operation.container, operation.elementId);
      const index = table.rows.findIndex((row) => row.id === operation.rowId);
      const cells = table.cells.filter((cell) => cell.rowId === operation.rowId);
      const merges = table.merges.filter(
        (merge) =>
          cells.some((cell) => cell.id === merge.rootCellId) ||
          merge.coveredCellIds.some((id) => cells.some((cell) => cell.id === id))
      );
      return [
        {
          type: "table.insert-row",
          container: operation.container,
          elementId: operation.elementId,
          row: clone(table.rows[index]),
          cells: clone(cells),
          ...withAfterRow(previousId(table.rows, index, (row) => row.id))
        },
        ...restoreMerges(operation.container, operation.elementId, merges)
      ];
    }
    case "table.insert-column":
      return [
        {
          type: "table.delete-column",
          container: operation.container,
          elementId: operation.elementId,
          columnId: operation.column.id
        }
      ];
    case "table.move-column": {
      const table = requireTable(before, operation.container, operation.elementId);
      const index = table.columns.findIndex((column) => column.id === operation.columnId);
      return [
        {
          type: "table.move-column",
          container: operation.container,
          elementId: operation.elementId,
          columnId: operation.columnId,
          ...withAfterColumn(previousId(table.columns, index, (column) => column.id))
        }
      ];
    }
    case "table.delete-column": {
      const table = requireTable(before, operation.container, operation.elementId);
      const index = table.columns.findIndex((column) => column.id === operation.columnId);
      const cells = table.cells.filter((cell) => cell.columnId === operation.columnId);
      const merges = table.merges.filter(
        (merge) =>
          cells.some((cell) => cell.id === merge.rootCellId) ||
          merge.coveredCellIds.some((id) => cells.some((cell) => cell.id === id))
      );
      return [
        {
          type: "table.insert-column",
          container: operation.container,
          elementId: operation.elementId,
          column: clone(table.columns[index]),
          cells: clone(cells),
          ...withAfterColumn(previousId(table.columns, index, (column) => column.id))
        },
        ...restoreMerges(operation.container, operation.elementId, merges)
      ];
    }
    case "table.merge":
      return [
        {
          type: "table.unmerge",
          container: operation.container,
          elementId: operation.elementId,
          mergeId: operation.merge.id
        }
      ];
    case "table.unmerge": {
      const table = requireTable(before, operation.container, operation.elementId);
      const merge = table.merges.find((candidate) => candidate.id === operation.mergeId);
      if (!merge) throw new SlideOperationError(`Table merge not found: ${operation.mergeId}`);
      return [
        {
          type: "table.merge",
          container: operation.container,
          elementId: operation.elementId,
          merge: clone(merge)
        }
      ];
    }
    case "image.set-source": {
      const element = requireElement(before, operation.container, operation.elementId);
      if (element.kind !== "image") {
        throw new SlideOperationError(`Element is not an image: ${operation.elementId}`);
      }
      return [
        {
          type: "image.set-source",
          container: operation.container,
          elementId: operation.elementId,
          source: clone(element.image.source)
        }
      ];
    }
    case "image.set-accessibility": {
      const element = requireElement(before, operation.container, operation.elementId);
      if (element.kind !== "image") {
        throw new SlideOperationError(`Element is not an image: ${operation.elementId}`);
      }
      return [
        {
          type: "image.set-accessibility",
          container: operation.container,
          elementId: operation.elementId,
          alt: element.image.alt,
          decorative: element.image.decorative
        }
      ];
    }
  }
};

const withAfter = (afterSlideId: string | undefined) =>
  afterSlideId === undefined ? {} : { afterSlideId };

const withAfterRow = (afterRowId: string | undefined) =>
  afterRowId === undefined ? {} : { afterRowId };

const withAfterColumn = (afterColumnId: string | undefined) =>
  afterColumnId === undefined ? {} : { afterColumnId };

const restoreMerges = (
  container: ElementContainerRef,
  elementId: string,
  merges: { id: string; rootCellId: string; coveredCellIds: string[] }[]
): SlideOperation[] =>
  merges.map((merge) => ({
    type: "table.merge",
    container,
    elementId,
    merge: clone(merge)
  }));

/**
 * Style order is part of canonical state, so restoring a deleted Style has to
 * put it back where it was rather than appending it.
 */
const styleOrderRestore = (before: DeckSnapshot, index: number): SlideOperation[] => {
  if (index === before.styles.styles.length - 1) return [];
  return before.styles.styles.slice(index).map((style) => ({
    type: "style.update",
    styleId: style.id,
    style: clone(style)
  }));
};

const fallbackStyleId = (snapshot: DeckSnapshot, excludeId: string): string => {
  const fallback = snapshot.styles.styles.find((style) => style.id !== excludeId);
  if (!fallback) throw new SlideOperationError("A Deck must retain at least one Style");
  return fallback.id;
};

const firstTokenOfKind = (
  snapshot: DeckSnapshot,
  kind: string,
  excludeId: string
): string => {
  for (const token of Object.values(snapshot.theme.tokens)) {
    if (token.kind === kind && token.id !== excludeId) return token.id;
  }
  throw new SlideOperationError(`No replacement token of kind ${kind} is available`);
};

const anyOtherMasterId = (snapshot: DeckSnapshot, excludeId: string): string => {
  const other = Object.keys(snapshot.masters).find((id) => id !== excludeId);
  if (!other) throw new SlideOperationError("A Deck must retain at least one Master");
  return other;
};

const anyOtherLayoutId = (snapshot: DeckSnapshot, excludeId: string): string => {
  const other = Object.keys(snapshot.layouts).find((id) => id !== excludeId);
  if (!other) throw new SlideOperationError("A Deck must retain at least one Layout");
  return other;
};

/**
 * Style and token deletion rewrite every reference to them. Restoring the
 * deleted thing does not restore those references, so the inverse carries the
 * reference edits back explicitly.
 */
const retargetInverse = (before: DeckSnapshot, after: DeckSnapshot): SlideOperation[] => {
  const operations: SlideOperation[] = [];
  if (canonicalDigest(before.styles) !== canonicalDigest(after.styles)) {
    for (const style of before.styles.styles) {
      const current = after.styles.styles.find((candidate) => candidate.id === style.id);
      if (current && canonicalDigest(current) !== canonicalDigest(style)) {
        operations.push({ type: "style.update", styleId: style.id, style: clone(style) });
      }
    }
    for (const kind of Object.keys(
      before.styles.defaultStyleIdByElementKind
    ) as (keyof typeof before.styles.defaultStyleIdByElementKind)[]) {
      if (
        before.styles.defaultStyleIdByElementKind[kind] !==
        after.styles.defaultStyleIdByElementKind[kind]
      ) {
        operations.push({
          type: "style.set-default",
          elementKind: kind,
          styleId: before.styles.defaultStyleIdByElementKind[kind]
        });
      }
    }
  }
  for (const container of allContainers(before)) {
    const current = findContainer(after, container.ref);
    if (!current) continue;
    for (const element of Object.values(container.elements)) {
      const now = current.elements[element.id];
      if (!now) continue;
      if (canonicalDigest(element) !== canonicalDigest(now)) {
        operations.push({
          type: "element.replace",
          container: container.ref,
          element: clone(element)
        });
      }
    }
  }
  if (canonicalDigest(before.theme.palette) !== canonicalDigest(after.theme.palette)) {
    operations.push({ type: "theme.set-palette", palette: clone(before.theme.palette) });
  }
  if (canonicalDigest(before.theme.typography) !== canonicalDigest(after.theme.typography)) {
    operations.push({ type: "theme.set-typography", typography: clone(before.theme.typography) });
  }
  return operations;
};

// ── Touched IDs ──────────────────────────────────────────────────────────

const CONTAINER_ORDER_SENTINEL = "$slides:slide-order";

const elementSubtreeIds = (
  elements: Record<string, SlideElement>,
  element: SlideElement
): string[] => [
  element.id,
  ...(element.kind === "group"
    ? descendantsOf(elements, element.id).map((descendant) => descendant.id)
    : [])
];

const operationIds = (snapshot: DeckSnapshot, operation: SlideOperation): string[] => {
  const ids = new Set<string>();
  const container = "container" in operation ? operation.container : undefined;
  const elements = container ? findContainer(snapshot, container)?.elements : undefined;

  switch (operation.type) {
    case "deck.rename":
    case "deck.set-lifecycle":
    case "canvas.set":
    case "theme.rename":
    case "theme.set-palette":
    case "theme.set-typography":
      break;
    case "token.create":
      ids.add(operation.token.id);
      break;
    case "token.update":
    case "token.delete":
      ids.add(operation.tokenId);
      break;
    case "style.create":
      ids.add(operation.style.id);
      break;
    case "style.update":
    case "style.delete":
      ids.add(operation.styleId);
      break;
    case "style.set-default":
      ids.add(`$slides:default-style:${operation.elementKind}`);
      break;
    case "master.insert":
      ids.add(operation.master.id);
      break;
    case "master.rename":
    case "master.set-background":
    case "master.delete":
      ids.add(operation.masterId);
      break;
    case "layout.insert":
      ids.add(operation.layout.id);
      break;
    case "layout.rename":
    case "layout.set-master":
    case "layout.set-background":
    case "layout.delete":
      ids.add(operation.layoutId);
      break;
    case "slot.insert":
      ids.add(operation.layoutId);
      ids.add(operation.slot.id);
      break;
    case "slot.update":
      ids.add(operation.slot.id);
      break;
    case "slot.delete":
      ids.add(operation.slotId);
      break;
    case "slide.insert":
      ids.add(operation.slide.id);
      ids.add(CONTAINER_ORDER_SENTINEL);
      break;
    case "slide.move":
    case "slide.delete":
      ids.add(operation.slideId);
      ids.add(CONTAINER_ORDER_SENTINEL);
      break;
    case "slide.set-layout":
    case "slide.set-title":
    case "slide.set-background":
      ids.add(operation.slideId);
      break;
    case "element.insert":
      ids.add(operation.element.id);
      // Insertion renumbers its sibling set, so the whole set is touched.
      if (elements) {
        for (const sibling of siblingsOf(elements, operation.element.parentGroupId)) {
          ids.add(sibling.id);
        }
      }
      break;
    case "element.replace":
    case "element.set-placement":
    case "element.set-style":
    case "element.set-rotation":
    case "element.set-flags":
      ids.add("elementId" in operation ? operation.elementId : operation.element.id);
      break;
    case "element.reorder":
    case "element.delete": {
      const element = elements?.[operation.elementId];
      if (element && elements) {
        for (const id of elementSubtreeIds(elements, element)) ids.add(id);
        for (const sibling of siblingsOf(elements, element.parentGroupId)) ids.add(sibling.id);
      } else {
        ids.add(operation.elementId);
      }
      if (operation.type === "element.reorder" && elements && operation.parentGroupId) {
        for (const sibling of siblingsOf(elements, operation.parentGroupId)) ids.add(sibling.id);
      }
      break;
    }
    case "element.group": {
      ids.add(operation.group.id);
      for (const memberId of operation.memberIds) ids.add(memberId);
      const first = elements?.[operation.memberIds[0]];
      if (elements && first) {
        for (const sibling of siblingsOf(elements, first.parentGroupId)) ids.add(sibling.id);
      }
      break;
    }
    case "element.ungroup": {
      ids.add(operation.groupId);
      const group = elements?.[operation.groupId];
      if (elements && group) {
        for (const id of elementSubtreeIds(elements, group)) ids.add(id);
        for (const sibling of siblingsOf(elements, group.parentGroupId)) ids.add(sibling.id);
      }
      break;
    }
    case "text-source.set":
    case "prompt.apply-derived-output": {
      const site = operation.type === "text-source.set" ? operation.target : operation.site;
      ids.add(promptSiteKey(site));
      ids.add(site.elementId);
      break;
    }
    case "rich-text.apply": {
      const target = operation.target;
      if (target.kind === "slide-notes") ids.add(`slide-notes:${target.slideId}`);
      else ids.add(target.elementId);
      for (const atom of readRichContentSafely(snapshot, target)?.atoms ?? []) {
        ids.add(atom.id);
      }
      break;
    }
    case "table.insert-row":
      ids.add(operation.elementId);
      ids.add(operation.row.id);
      break;
    case "table.move-row":
    case "table.delete-row":
      ids.add(operation.elementId);
      ids.add(operation.rowId);
      break;
    case "table.insert-column":
      ids.add(operation.elementId);
      ids.add(operation.column.id);
      break;
    case "table.move-column":
    case "table.delete-column":
      ids.add(operation.elementId);
      ids.add(operation.columnId);
      break;
    case "table.merge":
      ids.add(operation.elementId);
      ids.add(operation.merge.id);
      break;
    case "table.unmerge":
      ids.add(operation.elementId);
      ids.add(operation.mergeId);
      break;
    case "image.set-source":
    case "image.set-accessibility":
      ids.add(operation.elementId);
      break;
  }
  return [...ids];
};

const readRichContentSafely = (
  snapshot: DeckSnapshot,
  target: RichContentTarget
): RichContent | undefined => {
  try {
    return readRichContent(snapshot, target);
  } catch {
    return undefined;
  }
};

export const computeTouchedIds = (
  snapshot: DeckSnapshot,
  operations: SlideOperation[]
): string[] =>
  [...new Set(operations.flatMap((operation) => operationIds(snapshot, operation)))].sort();

// ── Entry points ─────────────────────────────────────────────────────────

export const applyOperations = (
  source: DeckSnapshot,
  operations: SlideOperation[],
  richText: RichText,
  limits: SlideLimits
): SlideApplyResult => {
  const snapshot = clone(source);
  let inverse: SlideOperation[] = [];
  for (const operation of operations) {
    const before = clone(snapshot);
    applyOne(snapshot, clone(operation), richText);
    inverse = [...inverseFor(before, operation, snapshot, richText), ...inverse];
  }
  const result = validateSnapshot(snapshot, richText, limits);
  if (!result.ok) throw new SlideValidationError(result.diagnostics);

  const beforeFormulas = snapshotFormulaMap(source);
  const afterFormulas = snapshotFormulaMap(snapshot);
  const formulaChanges: FormulaAtomChange[] = [];
  for (const [atomId, candidate] of afterFormulas) {
    const previous = beforeFormulas.get(atomId);
    if (!previous || previous.expression !== candidate.expression) {
      formulaChanges.push({ atomId, ...candidate });
    }
  }

  return {
    snapshot,
    forward: clone(operations),
    inverse,
    touchedIds: computeTouchedIds(source, operations),
    formulaChanges
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

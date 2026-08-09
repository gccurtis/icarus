import type { RichContent } from "#rich-text";
import type {
  DeckSnapshot,
  ElementContainerRef,
  RichContentTarget,
  SlideElement,
  SlideTextSource,
  PromptSite
} from "./model.js";

export interface ElementContainer {
  ref: ElementContainerRef;
  elements: Record<string, SlideElement>;
}

export interface ElementLocation {
  container: ElementContainerRef;
  elements: Record<string, SlideElement>;
  element: SlideElement;
}

// ── Containers ───────────────────────────────────────────────────────────

export const findContainer = (
  snapshot: DeckSnapshot,
  ref: ElementContainerRef
): ElementContainer | undefined => {
  if (ref.kind === "slide") {
    const slide = snapshot.slides[ref.slideId];
    return slide ? { ref, elements: slide.elements } : undefined;
  }
  if (ref.kind === "master") {
    const master = snapshot.masters[ref.masterId];
    return master ? { ref, elements: master.elements } : undefined;
  }
  const layout = snapshot.layouts[ref.layoutId];
  return layout ? { ref, elements: layout.elements } : undefined;
};

export const containerId = (ref: ElementContainerRef): string =>
  ref.kind === "slide" ? ref.slideId : ref.kind === "master" ? ref.masterId : ref.layoutId;

export const sameContainer = (
  left: ElementContainerRef,
  right: ElementContainerRef
): boolean => left.kind === right.kind && containerId(left) === containerId(right);

/** Every element container in the Deck, in a deterministic order. */
export const allContainers = (snapshot: DeckSnapshot): ElementContainer[] => {
  const containers: ElementContainer[] = [];
  for (const masterId of Object.keys(snapshot.masters).sort()) {
    containers.push({
      ref: { kind: "master", masterId },
      elements: snapshot.masters[masterId].elements
    });
  }
  for (const layoutId of Object.keys(snapshot.layouts).sort()) {
    containers.push({
      ref: { kind: "layout", layoutId },
      elements: snapshot.layouts[layoutId].elements
    });
  }
  for (const slideId of snapshot.slideOrder) {
    const slide = snapshot.slides[slideId];
    if (slide) containers.push({ ref: { kind: "slide", slideId }, elements: slide.elements });
  }
  return containers;
};

export const findElement = (
  snapshot: DeckSnapshot,
  ref: ElementContainerRef,
  elementId: string
): ElementLocation | undefined => {
  const container = findContainer(snapshot, ref);
  const element = container?.elements[elementId];
  if (!container || !element) return undefined;
  return { container: ref, elements: container.elements, element };
};

/** Locate an element without knowing its container. */
export const locateElement = (
  snapshot: DeckSnapshot,
  elementId: string
): ElementLocation | undefined => {
  for (const container of allContainers(snapshot)) {
    const element = container.elements[elementId];
    if (element) {
      return { container: container.ref, elements: container.elements, element };
    }
  }
  return undefined;
};

export const forEachElement = (
  snapshot: DeckSnapshot,
  visitor: (element: SlideElement, container: ElementContainerRef) => void
): void => {
  for (const container of allContainers(snapshot)) {
    for (const id of Object.keys(container.elements).sort()) {
      visitor(container.elements[id], container.ref);
    }
  }
};

// ── Sibling order ────────────────────────────────────────────────────────

/**
 * `zIndex` is the sole sibling-order authority. Within one container, the
 * elements sharing a `parentGroupId` (or sharing its absence) form a sibling
 * set whose `zIndex` values are exactly 0..n-1, back to front.
 */
export const siblingsOf = (
  elements: Record<string, SlideElement>,
  parentGroupId: string | undefined
): SlideElement[] =>
  Object.values(elements)
    .filter((element) => element.parentGroupId === parentGroupId)
    .sort((left, right) => left.zIndex - right.zIndex);

export const rootElements = (
  elements: Record<string, SlideElement>
): SlideElement[] => siblingsOf(elements, undefined);

export const childrenOf = (
  elements: Record<string, SlideElement>,
  groupId: string
): SlideElement[] => siblingsOf(elements, groupId);

/**
 * Every transitive member of a Group: a parent before its own children, and
 * siblings in ascending `zIndex`. The reducer's delete-inverse restores in
 * exactly this order, so each member's parent exists before it is written.
 *
 * The `seen` guard is not decoration. Validation rejects a parent cycle, but
 * this runs on snapshots that arrive from storage as well as from the reducer,
 * and an unguarded walk over a cycle overflows the stack rather than failing a
 * check.
 */
export const descendantsOf = (
  elements: Record<string, SlideElement>,
  groupId: string
): SlideElement[] => {
  const collected: SlideElement[] = [];
  const seen = new Set<string>([groupId]);
  const walk = (parentId: string): void => {
    for (const child of childrenOf(elements, parentId)) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      collected.push(child);
      if (child.kind === "group") walk(child.id);
    }
  };
  walk(groupId);
  return collected;
};

/**
 * Elements not reachable from the container root by following `parentGroupId`.
 * A parent cycle is exactly a set of elements that is unreachable, so this is
 * the acyclicity check — and unlike walking ancestors from each element, it
 * cannot be defeated by the cycle it is looking for.
 */
export const unreachableElementIds = (
  elements: Record<string, SlideElement>
): string[] => {
  const reachable = new Set<string>();
  const walk = (parentGroupId: string | undefined): void => {
    for (const element of siblingsOf(elements, parentGroupId)) {
      if (reachable.has(element.id)) continue;
      reachable.add(element.id);
      if (element.kind === "group") walk(element.id);
    }
  };
  walk(undefined);
  return Object.keys(elements)
    .filter((id) => !reachable.has(id))
    .sort();
};

export const ancestorsOf = (
  elements: Record<string, SlideElement>,
  elementId: string
): SlideElement[] => {
  const chain: SlideElement[] = [];
  const seen = new Set<string>([elementId]);
  let current = elements[elementId]?.parentGroupId;
  while (current !== undefined && !seen.has(current)) {
    const parent = elements[current];
    if (!parent) break;
    chain.push(parent);
    seen.add(current);
    current = parent.parentGroupId;
  }
  return chain;
};

export const groupDepth = (
  elements: Record<string, SlideElement>,
  elementId: string
): number => ancestorsOf(elements, elementId).length;

/** True when `candidateId` is `groupId` itself or lies beneath it. */
export const isWithinGroup = (
  elements: Record<string, SlideElement>,
  candidateId: string,
  groupId: string
): boolean =>
  candidateId === groupId ||
  ancestorsOf(elements, candidateId).some((ancestor) => ancestor.id === groupId);

/**
 * Back-to-front paint order: each sibling set in `zIndex` order, with a Group's
 * members emitted immediately after the Group itself.
 */
export const paintOrder = (
  elements: Record<string, SlideElement>
): SlideElement[] => {
  const ordered: SlideElement[] = [];
  const walk = (parentGroupId: string | undefined): void => {
    for (const element of siblingsOf(elements, parentGroupId)) {
      ordered.push(element);
      if (element.kind === "group") walk(element.id);
    }
  };
  walk(undefined);
  return ordered;
};

// ── Sibling-order mutation ───────────────────────────────────────────────
//
// These mutate the element record in place, exactly as Document's reducer
// splices its row and block arrays in place. Every one of them preserves the
// contiguous-0..n-1 invariant on the sibling sets it touches.

/** Reassign 0..n-1 to a sibling set, preserving relative order. */
export const compactSiblings = (
  elements: Record<string, SlideElement>,
  parentGroupId: string | undefined
): void => {
  const siblings = siblingsOf(elements, parentGroupId);
  for (let index = 0; index < siblings.length; index += 1) {
    siblings[index].zIndex = index;
  }
};

/**
 * Open a slot at `zIndex` in a sibling set by shifting everything at or above
 * it up by one. The caller then writes the element at that index.
 */
export const openSiblingSlot = (
  elements: Record<string, SlideElement>,
  parentGroupId: string | undefined,
  zIndex: number
): number => {
  const siblings = siblingsOf(elements, parentGroupId);
  const target = Math.max(0, Math.min(zIndex, siblings.length));
  for (const sibling of siblings) {
    if (sibling.zIndex >= target) sibling.zIndex += 1;
  }
  return target;
};

/** Close the gap left by an element removed from a sibling set. */
export const closeSiblingGap = (
  elements: Record<string, SlideElement>,
  parentGroupId: string | undefined,
  removedZIndex: number
): void => {
  for (const sibling of siblingsOf(elements, parentGroupId)) {
    if (sibling.zIndex > removedZIndex) sibling.zIndex -= 1;
  }
};

/** Insert an already-constructed element into a sibling set at `zIndex`. */
export const insertIntoSiblings = (
  elements: Record<string, SlideElement>,
  element: SlideElement,
  parentGroupId: string | undefined,
  zIndex: number
): void => {
  const target = openSiblingSlot(elements, parentGroupId, zIndex);
  element.parentGroupId = parentGroupId;
  if (parentGroupId === undefined) delete element.parentGroupId;
  element.zIndex = target;
  elements[element.id] = element;
};

/** Detach an element from its sibling set without deleting it. */
export const detachFromSiblings = (
  elements: Record<string, SlideElement>,
  element: SlideElement
): void => {
  const parentGroupId = element.parentGroupId;
  delete elements[element.id];
  closeSiblingGap(elements, parentGroupId, element.zIndex);
};

// ── Content surfaces ─────────────────────────────────────────────────────

export interface RichContentEntry {
  target: RichContentTarget;
  content: RichContent;
}

const containerRichContent = (
  container: ElementContainer,
  visit: (entry: RichContentEntry) => void
): void => {
  for (const id of Object.keys(container.elements).sort()) {
    const element = container.elements[id];
    if (element.kind === "text" && element.body.kind === "rich") {
      visit({
        target: { kind: "element-body", container: container.ref, elementId: element.id },
        content: element.body.content
      });
      continue;
    }
    if (element.kind === "table") {
      for (const cell of element.table.cells) {
        if (cell.body.kind !== "rich") continue;
        visit({
          target: {
            kind: "table-cell",
            container: container.ref,
            elementId: element.id,
            cellId: cell.id
          },
          content: cell.body.content
        });
      }
      continue;
    }
    if (element.kind === "chart") {
      for (const label of element.chart.labels) {
        visit({
          target: {
            kind: "chart-label",
            container: container.ref,
            elementId: element.id,
            labelId: label.id
          },
          content: label.content
        });
      }
    }
  }
};

/** Every Rich Content surface in the Deck, with the target that addresses it. */
export const forEachRichContent = (
  snapshot: DeckSnapshot,
  visit: (entry: RichContentEntry) => void
): void => {
  for (const container of allContainers(snapshot)) {
    containerRichContent(container, visit);
  }
  for (const slideId of snapshot.slideOrder) {
    const slide = snapshot.slides[slideId];
    if (slide) visit({ target: { kind: "slide-notes", slideId }, content: slide.notes });
  }
};

export const findRichContent = (
  snapshot: DeckSnapshot,
  target: RichContentTarget
): RichContent | undefined => {
  if (target.kind === "slide-notes") return snapshot.slides[target.slideId]?.notes;
  const located = findElement(snapshot, target.container, target.elementId);
  if (!located) return undefined;
  const { element } = located;
  if (target.kind === "element-body") {
    return element.kind === "text" && element.body.kind === "rich"
      ? element.body.content
      : undefined;
  }
  if (target.kind === "table-cell") {
    if (element.kind !== "table") return undefined;
    const cell = element.table.cells.find((candidate) => candidate.id === target.cellId);
    return cell?.body.kind === "rich" ? cell.body.content : undefined;
  }
  if (element.kind !== "chart") return undefined;
  return element.chart.labels.find((label) => label.id === target.labelId)?.content;
};

/**
 * The Rich Content target that addresses the same surface as a prompt site.
 * Every `PromptSite` is also a `RichContentTarget`; the reverse does not hold,
 * because chart labels and Slide notes are authored-only.
 */
export const siteAsRichContentTarget = (site: PromptSite): RichContentTarget => site;

export const findTextSource = (
  snapshot: DeckSnapshot,
  site: PromptSite
): SlideTextSource | undefined => {
  const element = findContainer(snapshot, site.container)?.elements[site.elementId];
  if (!element) return undefined;
  if (site.kind === "element-body") {
    return element.kind === "text" ? element.body : undefined;
  }
  if (element.kind !== "table") return undefined;
  return element.table.cells.find((cell) => cell.id === site.cellId)?.body;
};

export interface PromptSiteEntry {
  site: PromptSite;
  outputId: string;
  appliedRevision: number;
}

/**
 * Every live `prompt` source, keyed by site, across all three planes. This is
 * what drives ownership transitions: the diff of these entries before and after
 * a mutation says which outputs attached and which detached.
 */
export const promptSites = (snapshot: DeckSnapshot): PromptSiteEntry[] => {
  const entries: PromptSiteEntry[] = [];
  for (const container of allContainers(snapshot)) {
    for (const elementId of Object.keys(container.elements).sort()) {
      const element = container.elements[elementId];
      if (element.kind === "text" && element.body.kind === "prompt") {
        entries.push({
          site: { kind: "element-body", container: container.ref, elementId },
          outputId: element.body.output.outputId,
          appliedRevision: element.body.output.appliedRevision
        });
        continue;
      }
      if (element.kind !== "table") continue;
      for (const cell of element.table.cells) {
        if (cell.body.kind !== "prompt") continue;
        entries.push({
          site: {
            kind: "table-cell",
            container: container.ref,
            elementId,
            cellId: cell.id
          },
          outputId: cell.body.output.outputId,
          appliedRevision: cell.body.output.appliedRevision
        });
      }
    }
  }
  return entries;
};

/** A stable string form of a site, used as a map key and as a touched ID. */
export const promptSiteKey = (site: PromptSite): string => {
  const container = `${site.container.kind}:${containerId(site.container)}`;
  return site.kind === "table-cell"
    ? `table-cell:${container}:${site.elementId}:${site.cellId}`
    : `element-body:${container}:${site.elementId}`;
};

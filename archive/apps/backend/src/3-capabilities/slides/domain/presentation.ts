import { findContainer, rootElements, paintOrder } from "./elements.js";
import type {
  DeckSnapshot,
  DeckTheme,
  ElementContainerRef,
  ElementFrame,
  Layout,
  LayoutSlot,
  Master,
  Slide,
  SlideBackground,
  SlideColor,
  SlideElement,
  ThemeValue
} from "./model.js";

/**
 * Three planes, fixed back to front: Master → Layout → Slide. Inheritance is
 * live within one Deck revision — a Layout references a Master and a Slide
 * references a Layout by ID, and no layer ever copies another, which is why
 * editing a Master changes every Slide beneath it immediately.
 */
export interface ResolvedPlane {
  slide: Slide;
  layout: Layout;
  master: Master;
}

export const resolvePlane = (
  snapshot: DeckSnapshot,
  slideId: string
): ResolvedPlane | undefined => {
  const slide = snapshot.slides[slideId];
  if (!slide) return undefined;
  const layout = snapshot.layouts[slide.layoutId];
  if (!layout) return undefined;
  const master = snapshot.masters[layout.masterId];
  if (!master) return undefined;
  return { slide, layout, master };
};

/** Slide override, else Layout override, else the Master's. */
export const resolveBackground = (
  snapshot: DeckSnapshot,
  slideId: string
): SlideBackground | undefined => {
  const plane = resolvePlane(snapshot, slideId);
  if (!plane) return undefined;
  if (plane.slide.background && plane.slide.background.kind !== "inherit") {
    return plane.slide.background;
  }
  if (plane.layout.background && plane.layout.background.kind !== "inherit") {
    return plane.layout.background;
  }
  return plane.master.background;
};

// ── Slots ────────────────────────────────────────────────────────────────

export const resolveSlot = (
  snapshot: DeckSnapshot,
  slideId: string,
  slotId: string
): LayoutSlot | undefined => resolvePlane(snapshot, slideId)?.layout.slots[slotId];

/**
 * Which element fills each slot. At most one element per Slide may bind a given
 * slot, so this is a function rather than a multimap; a second binding is a
 * validation error, not something resolved here.
 */
export const slotBindings = (
  snapshot: DeckSnapshot,
  slideId: string
): Map<string, string> => {
  const bindings = new Map<string, string>();
  const slide = snapshot.slides[slideId];
  if (!slide) return bindings;
  for (const elementId of Object.keys(slide.elements).sort()) {
    const element = slide.elements[elementId];
    if (element.placement.kind === "slot" && !bindings.has(element.placement.slotId)) {
      bindings.set(element.placement.slotId, element.id);
    }
  }
  return bindings;
};

/**
 * Slots with no element bound. An unfilled slot is a completeness *hint* — a
 * half-finished Slide is legal — so this is a projection input, never a
 * validation diagnostic.
 */
export const unfilledSlots = (
  snapshot: DeckSnapshot,
  slideId: string
): LayoutSlot[] => {
  const plane = resolvePlane(snapshot, slideId);
  if (!plane) return [];
  const bound = slotBindings(snapshot, slideId);
  return Object.keys(plane.layout.slots)
    .sort()
    .map((slotId) => plane.layout.slots[slotId])
    .filter((slot) => !bound.has(slot.id));
};

/**
 * A slot-bound element has exactly one frame authority — the slot's — so it
 * follows slot edits live. A binding whose slot has been deleted resolves to
 * `undefined` rather than to a stale frame.
 */
export const resolveElementFrame = (
  snapshot: DeckSnapshot,
  container: ElementContainerRef,
  element: SlideElement
): ElementFrame | undefined => {
  if (element.placement.kind === "free") return element.placement.frame;
  if (container.kind !== "slide") return undefined;
  return resolveSlot(snapshot, container.slideId, element.placement.slotId)?.frame;
};

/**
 * The frame a slot-bound element keeps when it detaches. Moving or resizing a
 * bound element detaches it to a free frame at the slot's then-current
 * position, which is what dragging a placeholder is expected to do.
 */
export const detachedFrameFor = (
  snapshot: DeckSnapshot,
  slideId: string,
  element: SlideElement
): ElementFrame | undefined =>
  element.placement.kind === "free"
    ? element.placement.frame
    : resolveSlot(snapshot, slideId, element.placement.slotId)?.frame;

export const slotAccepts = (slot: LayoutSlot, element: SlideElement): boolean =>
  slot.accepts.length === 0 || slot.accepts.includes(element.kind);

// ── Composed plan ────────────────────────────────────────────────────────

export interface PlanEntry {
  container: ElementContainerRef;
  element: SlideElement;
  /** Absent when a slot binding no longer resolves. */
  frame?: ElementFrame;
}

export interface SlidePresentationPlan {
  slideId: string;
  layoutId: string;
  masterId: string;
  background?: SlideBackground;
  /** Master elements, then Layout elements, then Slide elements. */
  entries: PlanEntry[];
  unfilledSlotIds: string[];
  /** Slot bindings whose slot no longer exists in the Layout. */
  danglingSlotIds: string[];
}

/**
 * The composed back-to-front plan for one Slide. This is data, not rendering:
 * it says which elements participate and what frame each resolves to, and says
 * nothing about how any of it should be drawn.
 */
export const resolveSlidePlan = (
  snapshot: DeckSnapshot,
  slideId: string
): SlidePresentationPlan | undefined => {
  const plane = resolvePlane(snapshot, slideId);
  if (!plane) return undefined;

  const entries: PlanEntry[] = [];
  const planeContainers: ElementContainerRef[] = [
    { kind: "master", masterId: plane.master.id },
    { kind: "layout", layoutId: plane.layout.id },
    { kind: "slide", slideId }
  ];
  for (const container of planeContainers) {
    const found = findContainer(snapshot, container);
    if (!found) continue;
    for (const element of paintOrder(found.elements)) {
      const frame = resolveElementFrame(snapshot, container, element);
      entries.push(frame ? { container, element, frame } : { container, element });
    }
  }

  const danglingSlotIds: string[] = [];
  for (const element of Object.values(plane.slide.elements)) {
    if (
      element.placement.kind === "slot" &&
      !plane.layout.slots[element.placement.slotId]
    ) {
      danglingSlotIds.push(element.placement.slotId);
    }
  }

  return {
    slideId,
    layoutId: plane.layout.id,
    masterId: plane.master.id,
    ...(resolveBackground(snapshot, slideId) !== undefined
      ? { background: resolveBackground(snapshot, slideId) }
      : {}),
    entries,
    unfilledSlotIds: unfilledSlots(snapshot, slideId).map((slot) => slot.id),
    danglingSlotIds: [...new Set(danglingSlotIds)].sort()
  };
};

// ── Theme resolution ─────────────────────────────────────────────────────
//
// Tokens never alias other tokens, so resolution cannot cycle. A reference must
// resolve to a token of the matching kind; a mismatch resolves to `undefined`
// rather than coercing.

export const resolveColor = (
  theme: DeckTheme,
  value: ThemeValue<SlideColor>
): SlideColor | undefined => {
  if (value.kind === "literal") return value.value;
  const token = theme.tokens[value.tokenId];
  return token?.kind === "color" ? token.value : undefined;
};

export const resolveFontFamily = (
  theme: DeckTheme,
  value: ThemeValue<string>
): string | undefined => {
  if (value.kind === "literal") return value.value;
  const token = theme.tokens[value.tokenId];
  return token?.kind === "font" ? token.family : undefined;
};

export const resolveLengthPt = (
  theme: DeckTheme,
  value: ThemeValue<number>
): number | undefined => {
  if (value.kind === "literal") return value.value;
  const token = theme.tokens[value.tokenId];
  return token?.kind === "length" ? token.valuePt : undefined;
};

/** Root-level elements of a container, back to front. Used by projections. */
export const containerRootElements = (
  snapshot: DeckSnapshot,
  container: ElementContainerRef
): SlideElement[] => {
  const found = findContainer(snapshot, container);
  return found ? rootElements(found.elements) : [];
};

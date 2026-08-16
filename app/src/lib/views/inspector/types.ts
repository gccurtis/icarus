/**
 * The inspector's public contract: the numbers the frame needs to lay this flank
 * out, and the bounds this panel enforces on its own drag.
 *
 * Deliberately the same minimum, maximum, and threshold as the context panel, so
 * the two edges of the work surface behave identically. Bounds live here rather
 * than in the model for the same reason they do there: the model records values,
 * and the panel is the thing that knows a gesture overshot.
 *
 * Unlike the context panel, every number here is the panel's whole width. The
 * inspector has no rail to add back — the model stores exactly what is painted.
 */

/**
 * What the flank narrows to when collapsed: a rail, matching the context
 * panel's, holding the one icon that expands it again.
 *
 * A collapsed panel is a rail rather than nothing, because a flank that vanishes
 * leaves no way back except finding a 4px edge. Both flanks collapse to the same
 * width and both expand by clicking an icon in the strip that remains.
 */
export const COLLAPSED_WIDTH = 44;

export const MIN_WIDTH = 224;
export const MAX_WIDTH = 480;

/**
 * Drag inside this and the panel collapses instead of clamping. Well below the
 * minimum, so easing up to the minimum stops there and only a deliberate throw
 * outward collapses.
 */
export const COLLAPSE_BELOW = Math.round(MIN_WIDTH * 0.6);

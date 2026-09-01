/**
 * The context panel's public contract: the numbers the frame needs to lay this
 * flank out, and the bounds this panel enforces on its own drag.
 *
 * Bounds live here rather than in the model deliberately. The model records
 * values; the panel is the thing that knows a gesture overshot, so a minimum
 * stored beside a width would be the same number in two places.
 *
 * **Everything below is a visible width — rail included.** The model stores the
 * *content* portion only, because the rail is structural and never resizes, so
 * whoever lays this flank out has to add the rail back. The panel converts at
 * that boundary, and the arithmetic stays in one direction: model plus rail
 * equals visible, always.
 */

/** Pixels. The rail is a fixed strip of icon targets, not a resizable column. */
export const RAIL_WIDTH = 44;

/**
 * The narrowest and widest a flank may be dragged, matched to the inspector's
 * so the two sides of the work surface behave alike. A user who learns one edge
 * has learned the other.
 */
export const MIN_WIDTH = 224;
export const MAX_WIDTH = 480;

/**
 * Drag inside this and the panel collapses to its rail instead of clamping.
 *
 * Well below the minimum rather than at it: easing up to the minimum should stop
 * there, and only a deliberate throw inward should collapse. A threshold at the
 * minimum turns the last few pixels of every resize into a trapdoor.
 */
export const COLLAPSE_BELOW = Math.round(MIN_WIDTH * 0.6);

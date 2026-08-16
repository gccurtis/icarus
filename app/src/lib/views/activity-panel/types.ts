/**
 * The activity panel's public contract.
 *
 * One value, and it exists because the panel's width is decided in two places
 * that must agree. The workbench stores `contextWidth` as the **content portion
 * only** — the rail is structural, never resizes, and never collapses, so it is
 * deliberately not part of that number. Whoever lays the panel out therefore has
 * to add the rail back, and that is the frame, not the panel.
 *
 * Exporting it as a typed constant rather than leaving the frame to declare a
 * `--rail-width` custom property the panel reads back is what makes the
 * dependency visible: a value one view owns and another imports, rather than a
 * name that has to be spelled identically in two stylesheets to work at all.
 */

/** Pixels. The rail is a fixed strip of icon targets, not a resizable column. */
export const RAIL_WIDTH = 44;

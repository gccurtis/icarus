/**
 * Moving something from one place to another.
 *
 * Its own family because a drag crosses the other two: the thing picked up is
 * frequently a row in a flank and the place it lands is a zone in the
 * middle of the plane. Neither vocabulary can own a shape that only exists in
 * the space between them.
 *
 * **Nothing here is drag-only**, which is the specifications' rule and the
 * reason both components take a list of destinations rather than only firing
 * events. The same declaration draws the drag target and the menu, so the
 * keyboard path cannot be the thing that gets left out of the fourth surface
 * someone builds.
 */
export { default as Draggable } from "$authored-components/drag/draggable.svelte";
export { default as DropZone } from "$authored-components/drag/drop-zone.svelte";

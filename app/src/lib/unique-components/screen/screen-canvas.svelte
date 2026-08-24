<script lang="ts">
  import type { Snippet } from "svelte";

  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * The ground a document, a deck or a template sits on. Not the thing itself:
   * the surround.
   *
   * Three workspaces need the same four rules — a darker fill, the only scroll
   * in the region, a centred column, and room on all four sides — because a page
   * that butts the edge of its zone stops reading as a sheet of paper and starts
   * reading as a background.
   *
   * **Not `ScreenSurface`.** That is a workspace's own padding, measure and
   * scroll for ordinary content, and its job is to get out of the way. A canvas
   * is the opposite: it is a *darker* ground that exists to be seen, so that the
   * thing on it reads as an object with edges. Put a table on a surface and a
   * page on a canvas.
   *
   * **The gutters go all the way round, and between.** Every gap here is canvas
   * rather than more paper — top, bottom, both sides, and the space between one
   * page and the next — which is the whole difference between a document that
   * floats and a document that is the wallpaper.
   *
   * **It reads a zoom rather than taking one.** The pasteboard scales by
   * `--canvas-zoom`, which defaults to 1 and which nothing here ever sets. Zoom
   * is a gesture on the work surface — a pinch arrives as a wheel event carrying
   * `ctrlKey`, and only the surface knows whether it should be caught — so a
   * `zoom` prop here would decide for all three surfaces that they zoom, and
   * decide it the same way. A surface that zooms sets the variable on an
   * ancestor and takes the gesture through `onwheel`; a surface that does not,
   * does nothing, and gets a canvas that never scales.
   */
  let {
    label,
    onwheel,
    children
  }: {
    /** What is on the canvas. Names the scroll region. */
    label: string;
    /**
     * The wheel, for a surface that zooms. It has to be taken on the element
     * that would otherwise scroll, which is this one — a handler bound to the
     * page inside it fires after the ground has already moved.
     */
    onwheel?: (event: WheelEvent) => void;
    /** `ScreenPage`s, `ScreenSlide`s, or whatever the surface floats. */
    children: Snippet;
  } = $props();

  const trace = traceNode("ScreenCanvas", () => ({ label }));
</script>

<!--
  `tabindex` so a keyboard can move the canvas itself, on the same reasoning
  `ScreenStrip` records: a scroll container that answers only a pointer is one
  half the people using it cannot move, and WCAG 2.1.1 asks for exactly this.
  The rule below has no exception for scroll containers, which is the one case
  where a focusable non-widget is the accessible answer rather than a mistake.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  {...trace}
  tabindex="0"
  role="group"
  aria-label={label}
  {onwheel}
  class="bg-surface-canvas focus-visible:outline-interactive-border ground focus-visible:outline-2"
>
  <div class="pasteboard">
    {@render children()}
  </div>
</div>

<style>
  .ground {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  /*
   * Centred, with room on all four sides and between whatever is stacked on it.
   * `top center` as the origin so zooming grows the work downward from where the
   * reader is looking rather than out of the top of the region.
   */
  .pasteboard {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 6);
    padding: calc(var(--token-spacing-unit) * 8);
    transform: scale(var(--canvas-zoom, 1));
    transform-origin: top center;
  }
</style>

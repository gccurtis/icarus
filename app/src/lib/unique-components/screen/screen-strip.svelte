<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * A row of cards you scroll, rather than one you step through.
   *
   * The counterpart to `ScreenShelf`, and it exists because the shelf cannot be
   * scrolled with two fingers. The shelf's motion is embla's, which owns the
   * pointer and the two buttons but not the wheel — so on a trackpad, the most
   * natural gesture for a horizontal row does nothing at all.
   *
   * This is a native scroll container, which means the browser's own gestures
   * come free: two fingers, shift-wheel, a dragged scrollbar, Home and End, and
   * arrow keys once it has focus. Nothing here re-implements any of that, which
   * is the point — a hand-written scroller is how those get lost one at a time.
   *
   * **It takes cards directly, with no item wrapper**, because the sizing is one
   * decision and it belongs to the row: the width, the refusal to shrink, and
   * the snap alignment are set on the children from here.
   *
   * **Snap `proximity`, not `mandatory`.** Mandatory snapping fights a long
   * flick and makes a row of twenty feel like it is resisting.
   *
   * **Reach for the shelf when the row is a display**, with its well and its
   * overhang; reach for this when the row is a list someone is getting through.
   */
  let {
    width = "13rem",
    label = "Scrollable row",
    children
  }: {
    /** How wide a card is here. */
    width?: string;
    /** Names the region, since a scroll container is reachable on its own. */
    label?: string;
    /** `ScreenCard`s, directly. */
    children: Snippet;
  } = $props();
</script>

<!--
  `tabindex` so a keyboard can reach the scroll container itself. A scroller
  that only answers a pointer is one that half the people using it cannot move,
  and WCAG 2.1.1 asks for exactly this. The rule below fires on any non-widget
  with a tabindex and has no exception for scroll containers, which is the one
  case where a focusable non-widget is the accessible answer rather than a
  mistake.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  tabindex="0"
  role="group"
  aria-label={label}
  style="--strip-card: {width}"
  class="focus-visible:outline-interactive-border -mx-1 flex snap-x snap-proximity gap-3 overflow-x-auto px-1 py-1 focus-visible:outline-2 [scrollbar-width:thin] [&>*]:w-[var(--strip-card)] [&>*]:shrink-0 [&>*]:snap-start"
>
  {@render children()}
</div>

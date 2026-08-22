<script lang="ts">
  import type { Snippet } from "svelte";

  import { traceNode } from "$lib/trace/trace.svelte";
  import { CarouselShelfItem } from "$lib/unique-components/carousel-shelf";

  /**
   * One place on the shelf, sized for a card.
   *
   * **It gives up the shelf item's own raised surface**, because what goes in it
   * is a `ScreenCard` and a card inside a card reads as a mistake. The card's
   * surface is the one that stays, and it is the right one to keep: it is the
   * surface that carries hover and selection, and a shelf whose cards cannot
   * show which one is chosen is a shelf you cannot choose from.
   *
   * The well, the frame, the overhang and the drag are all still the shelf's.
   * Those are what a grid does not have, and they are the reason to be on a
   * shelf at all.
   */
  let {
    width = "13rem",
    children
  }: {
    /** How wide a card is here. The shelf fits as many as the screen allows. */
    width?: string;
    children: Snippet;
  } = $props();

  // Root is a component, not an element, so the node registers but marks no DOM.
  const trace = traceNode("ScreenShelfItem", () => ({ width }));
</script>

<CarouselShelfItem class="border-none bg-transparent shadow-none">
  <div style="width: {width}">{@render children()}</div>
</CarouselShelfItem>

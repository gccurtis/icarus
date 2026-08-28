<script lang="ts">
  import type { Snippet } from "svelte";

  import { traceNode } from "$development-components/trace.svelte";
  import { CarouselShelf } from "$authored-components/carousel-shelf";

  /**
   * Cards on a shelf rather than in a grid.
   *
   * The other way to show things you recognise by looking. `ScreenCards` is the
   * library — everything at once, wrapping down the page, for when the reader is
   * looking for one particular thing. This is the shelf: a single row you push
   * sideways, for when the reader is browsing rather than searching, and when
   * the row is one band of a screen that has other bands under it.
   *
   * The motion, the well, the frame's overhang and the two buttons are
   * `unique-components/carousel-shelf`, unmodified. What this adds is the
   * screen's vocabulary — items sized for a card, holding `ScreenCard`s — so a
   * shelf of templates and a shelf of layouts are the same width everywhere.
   *
   * **Reach for the grid when the reader has to find something.** A shelf hides
   * most of its contents off the edge, which is right for six recent things and
   * wrong for sixty templates: what is off-screen cannot be scanned, and no
   * amount of pushing makes a row searchable.
   */
  let { children }: { children: Snippet } = $props();

  // `CarouselShelf` forwards its rest props, so the marker lands on the element it renders.
  const trace = traceNode("ScreenShelf");
</script>

<CarouselShelf {...trace}>
  {@render children()}
</CarouselShelf>

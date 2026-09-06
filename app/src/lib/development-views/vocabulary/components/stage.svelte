<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * The frame an example renders inside.
   *
   * **Panel examples are shown at a flank's real width.** A primitive that reads
   * well across a plane and breaks in a flank is the exact failure this
   * catalogue exists to catch, so showing one wide would defeat the page. Screen
   * examples get the full measure, for the same reason in reverse.
   *
   * That width is 320px — inside the inspector's real 224–480 bounds. It used to
   * be 180px, which is 44px under the application's own minimum, so every
   * example on this page was being judged at a width the product never renders
   * and half of them were reported as clipped.
   */
  let {
    width = "panel",
    children
  }: {
    /** `panel` pins to a flank's body width. `screen` fills. */
    width?: "panel" | "screen";
    children: Snippet;
  } = $props();
</script>

<div
  class="border-border-subtle bg-surface-panel rounded-panel overflow-hidden border"
  class:w-80={width === "panel"}
  class:w-full={width === "screen"}
>
  {@render children()}
</div>

<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * The frame an example renders inside.
   *
   * **Panel examples are shown at a flank's real width.** A primitive that reads
   * well across a plane and breaks in a flank is the exact failure this
   * catalogue exists to catch, so showing one wide would defeat the page. Screen
   * examples get the full measure, for the same reason in reverse.
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
  class:w-45={width === "panel"}
  class:w-full={width === "screen"}
>
  {@render children()}
</div>

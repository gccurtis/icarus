<script lang="ts">
  import type { Snippet } from "svelte";

  /**
   * A responsive grid of cards, for the libraries whose contents are shapes.
   *
   * Templates, analyses, personas and layouts are all things you recognise by
   * looking rather than by reading, which is the whole reason those four screens
   * are card grids and the other four are tables. A list of chart titles is not
   * a way to find a chart.
   */
  let {
    min = "13rem",
    children
  }: {
    /** The narrowest a card may be before the grid drops a column. */
    min?: string;
    children: Snippet;
  } = $props();
</script>

<div class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax({min}, 1fr))">
  {@render children()}
</div>

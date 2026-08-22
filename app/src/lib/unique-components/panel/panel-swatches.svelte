<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * The colours a thing has, listed.
   *
   * A deck theme's four named colours, a chart's series assignment, the key to a
   * status map. It exists because three panels had already written it by hand —
   * the theme inspector, the theme context and the chart inspector each carry a
   * `<style>` block with `.swatches`, `.swatch` and `.chip` in it, at three
   * different sizes, which is the tell that a word was missing.
   *
   * **Not `PanelColor`.** That is a radiogroup: its swatches are targets, one of
   * them is checked, and pressing one sets a fill. This is a listing. Most of
   * these are not selectable at all, and the ones that are open the lens for
   * that colour rather than choosing it — a theme's palette is a fact about the
   * deck, not a control over it, and drawing it as a picker offers an edit that
   * does not exist.
   *
   * **The layout is the caller's, because it follows the names.** "Accent 1"
   * and "Paper" are short enough that four of them wrap onto two lines and read
   * as a palette; "Peak demand (winter)" is not, and wrapping those gives a
   * ragged block where nothing lines up. A column puts one per line with its
   * value at the end, which is the only form long names survive.
   */
  let {
    label,
    layout = "wrap",
    flush = false,
    children
  }: {
    /** What set this is — "Palette", "Series colours". Names the list. */
    label: string;
    /** `wrap` for short names, `column` for long ones or where values are shown. */
    layout?: "wrap" | "column";
    /** Drop the panel gutter, for a listing nested inside a padded region. */
    flush?: boolean;
    /** `PanelSwatch`es. */
    children: Snippet;
  } = $props();

  const trace = traceNode("PanelSwatches", () => ({ label, layout, flush }));
</script>

<!--
  `role="list"` alongside the tag: removing the markers removes the list
  semantics in Safari, and this is a list whose length is the point.
-->
<ul
  {...trace}
  role="list"
  aria-label={label}
  class={cn(
    "m-0 flex list-none p-0",
    layout === "column" ? "flex-col gap-0.5" : "flex-row flex-wrap gap-x-3 gap-y-0.5",
    flush ? "px-0" : "px-3"
  )}
>
  {@render children()}
</ul>

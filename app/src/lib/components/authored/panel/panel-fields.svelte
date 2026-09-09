<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * A block of label-and-value pairs.
   *
   * A description list rather than a two-column grid of divs, because that is
   * what it is: every value here is described by its label, and a screen reader
   * should be able to say so.
   *
   * The labels column is fixed rather than sized to content, so the values in a
   * panel line up with the values in the panel above it. It is deliberately
   * narrow — a flank is narrow, and a label column that takes a third of it
   * leaves nothing for the value — so a pair whose value will not fit stacks instead,
   * which is `PanelField`'s `stacked`.
   */
  let {
    proportional = false,
    align = "start",
    children
  }: {
    /** Let both columns shrink with the flank instead of holding a fixed label width. */
    proportional?: boolean;
    /** Align compact values to the trailing edge. */
    align?: "start" | "end";
    children: Snippet;
  } = $props();

  const trace = traceNode("PanelFields", () => ({ proportional, align }));
</script>

<dl
  {...trace}
  class={cn(
    "m-0 grid items-baseline gap-x-2 gap-y-1.5 px-3",
    align === "end"
      ? "grid-cols-[minmax(0,max-content)_minmax(0,1fr)] [&>dd]:text-end"
      : proportional
        ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        : "grid-cols-[minmax(0,7rem)_minmax(0,1fr)]"
  )}
>
  {@render children()}
</dl>

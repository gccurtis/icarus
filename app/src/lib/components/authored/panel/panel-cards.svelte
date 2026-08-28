<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * A small set chosen by its picture rather than its name.
   *
   * `PanelChoice` is the same decision in words, and words are right for a scope
   * or a mode. They are wrong for a chart kind: *Bar*, *Line*, *Pie* and *Area*
   * are shapes, and a person picking one is matching a shape to their data, not
   * reading a list. The same is true of a slide layout and a page orientation.
   *
   * **Two or three across, and never more.** A 276px body divided four ways
   * leaves 60px a side, which is not a picture of anything. What does not fit in
   * three columns belongs in a modal, where the plane is wide.
   *
   * It holds `PanelThumb`s, or any small square the caller draws. The chosen one
   * is the caller's to mark — `PanelThumb` already carries `selected`, and a
   * second selected state here would be two claims about one card.
   */
  let {
    label,
    columns = 3,
    children
  }: {
    /** What is being chosen. The group's accessible name. */
    label: string;
    /** Two or three. Anything wider is not a picture at 300px. */
    columns?: 2 | 3;
    children: Snippet;
  } = $props();

  const trace = traceNode("PanelCards", () => ({ label, columns }));
</script>

<div
  {...trace}
  role="group"
  aria-label={label}
  class={cn("grid gap-1.5 px-3", columns === 2 ? "grid-cols-2" : "grid-cols-3")}
>
  {@render children()}
</div>

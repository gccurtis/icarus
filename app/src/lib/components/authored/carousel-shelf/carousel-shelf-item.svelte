<script lang="ts">
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";
  import type { Snippet } from "svelte";

  let {
    class: className,
    children
  }: { class?: string; children?: Snippet } = $props();

  const trace = traceNode("CarouselShelfItem", () => ({}));
</script>

<!--
  A fixed-width place in the shelf. The parent owns spacing so this element can
  start at the scrollport's inset and move freely rather than being pulled to a
  carousel detent.
-->
<div {...trace} class="shrink-0">
  <div
    class={cn(
      "bg-surface-elevated border-border-subtle rounded-panel shadow-raised border",
      className
    )}
  >
    {@render children?.()}
  </div>
</div>

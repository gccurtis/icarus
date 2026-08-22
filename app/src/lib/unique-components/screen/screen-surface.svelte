<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * The scrolling plane a screen's content sits on.
   *
   * Every workspace that is not a canvas is this: one column, generous padding,
   * a maximum measure so a table does not stretch to 2000px, and the zone's only
   * scroll. It exists so ten screens do not each decide those four things.
   *
   * **No scrollbar**, for the same reason panels have none — every surface
   * scrolls and none spends width saying so.
   */
  let {
    wide = false,
    children,
    class: className
  }: {
    /** Let content run to the full zone width, for two-column and canvas layouts. */
    wide?: boolean;
    children: Snippet;
    class?: string;
  } = $props();

  const trace = traceNode("ScreenSurface", () => ({ wide }));
</script>

<div
  {...trace}
  class={cn(
    "flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-6",
    "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
    !wide && "mx-auto w-full max-w-5xl",
    className
  )}
>
  {@render children()}
</div>

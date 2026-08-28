<script lang="ts">
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * A placeholder for a shape that will one day be rendered from real content.
   *
   * Bars of no particular content, at the aspect ratio of the thing they stand
   * for. It is deliberately abstract: a thumbnail that invented a title and a
   * paragraph would be a drawing of a document rather than a placeholder for
   * one, and the difference stops mattering to whoever reviews it.
   *
   * **The `variable` bars are tinted with the intelligence role.** In a template
   * preview they mark the parts left open, which is the one thing a template's
   * shape actually has to say.
   */
  let {
    ratio = "4 / 3",
    lines = 4,
    variables = 0
  }: {
    /** `16 / 9` for a slide, `4 / 3` for a page, `1 / 1` for a grid. */
    ratio?: string;
    lines?: number;
    /** How many of the lines stand for an opening rather than content. */
    variables?: number;
  } = $props();

  const trace = traceNode("ScreenThumb", () => ({ ratio, lines, variables }));
</script>

<span
  {...trace}
  class="border-border-subtle bg-surface-canvas rounded-control flex flex-col justify-center gap-1.5 border p-2.5"
  style="aspect-ratio: {ratio}"
  aria-hidden="true"
>
  {#each Array.from({ length: lines }) as _, index (index)}
    <span
      class={cn(
        "h-1 rounded-full",
        index < variables ? "bg-intelligence-border" : "bg-border-strong"
      )}
      style="width: {[70, 90, 55, 80, 65, 85][index % 6]}%"
    ></span>
  {/each}
</span>

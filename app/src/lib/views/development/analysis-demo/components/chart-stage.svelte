<script lang="ts">
  import { Chart, ChartGrowth, ChartMekko } from "$components/authored/chart";

  /**
   * The chart, framed, with the growth strip under it where one applies.
   *
   * Two things branch here rather than inside `Chart`. A Marimekko needs a
   * second quantity — the one that sets each column's width — which no other
   * kind reads, so putting it behind a `kind` would give `Chart` a prop that is
   * meaningless five times out of six. And the growth strip is a sibling of the
   * chart rather than part of it: it reads along the category axis, so it exists
   * for a vertical bar chart and is nonsense on a pie.
   */
  let {
    kind,
    layout,
    orientation,
    labels = "none",
    data,
    series,
    growth = false,
    categories = [],
    totals = [],
    svg = $bindable(null),
    hovered = $bindable(undefined)
  }: {
    kind: string;
    layout: string;
    orientation: string;
    labels?: string;
    data: readonly Record<string, string | number>[];
    series: readonly { key: string; label?: string }[];
    /** Whether the change-per-element strip applies to this chart. */
    growth?: boolean;
    categories?: readonly string[];
    totals?: readonly number[];
    svg?: SVGSVGElement | null;
    /** Shared with the table, so hovering either highlights the other. */
    hovered?: string | undefined;
  } = $props();
</script>

<div class="border-border-subtle rounded-panel bg-surface-panel flex flex-col gap-2 border p-4">
  {#if kind === "mekko"}
    <!--
      The Mekko reads the same series as everything else, plus one field nothing
      else needs: the total, which sets each column's width. That is the whole
      difference — how much of the loss each region accounts for, as well as what
      caused it.
    -->
    <ChartMekko bind:ref={svg} {data} x="region" weight="total" {series} />
  {:else}
    <Chart
      bind:ref={svg}
      kind={kind as "bar" | "line" | "area" | "pie" | "scatter" | "mixed"}
      {data}
      x="region"
      {series}
      layout={layout as "overlap" | "group" | "stack" | "stackExpand"}
      orientation={orientation as "vertical" | "horizontal"}
      labels={labels as "none" | "value" | "total"}
      lineSeries="planned"
      bind:hovered
    />

    {#if growth}
      <ChartGrowth labels={categories} values={totals} />
    {/if}
  {/if}
</div>

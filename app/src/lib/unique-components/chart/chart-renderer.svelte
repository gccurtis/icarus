<script lang="ts">
  import type { ChartModel } from "$json-store/types/data/chart";
  import { capabilitiesFor, chartIssues } from "$lib/unique-components/chart/chart-model";
  import { createChartSelection, type ChartSelection } from "$lib/unique-components/chart/chart-selection.svelte";
  import { seriesColor } from "$lib/unique-components/chart/palette";
  import PlotBars from "$lib/unique-components/chart/plot/plot-bars.svelte";
  import PlotFunnel from "$lib/unique-components/chart/plot/plot-funnel.svelte";
  import PlotHeatmap from "$lib/unique-components/chart/plot/plot-heatmap.svelte";
  import PlotLines from "$lib/unique-components/chart/plot/plot-lines.svelte";
  import PlotMekko from "$lib/unique-components/chart/plot/plot-mekko.svelte";
  import PlotPie from "$lib/unique-components/chart/plot/plot-pie.svelte";
  import PlotPoints from "$lib/unique-components/chart/plot/plot-points.svelte";
  import PlotRadar from "$lib/unique-components/chart/plot/plot-radar.svelte";
  import PlotTreemap from "$lib/unique-components/chart/plot/plot-treemap.svelte";
  import PlotWaterfall from "$lib/unique-components/chart/plot/plot-waterfall.svelte";

  const localSelection = createChartSelection();

  let {
    chart,
    selection = localSelection,
    height = 300,
    showTitle = true,
    ref = $bindable(null)
  }: {
    chart: ChartModel;
    selection?: ChartSelection;
    height?: number;
    showTitle?: boolean;
    ref?: SVGSVGElement | null;
  } = $props();

  let plotWidth = $state(1000);
  let plotHeight = $state(height);
  let hoveredSeriesId = $state<string | undefined>(undefined);
  let hoveredCategoryId = $state<string | undefined>(undefined);

  const capabilities = $derived(capabilitiesFor(chart.type));
  const legendEntries = $derived(
    capabilities.legendDimension === "series"
      ? chart.data.series
          .filter((entry) => !entry.hidden)
          .map((entry) => ({
            id: entry.id,
            label: entry.label,
            color: entry.color ?? seriesColor(chart.data.series.indexOf(entry)),
            kind: "series" as const
          }))
      : capabilities.legendDimension === "category"
        ? chart.data.categories.map((entry, index) => ({
          id: entry.id,
          label: entry.label,
          color:
            chart.data.datums.find((datum) => datum.categoryId === entry.id)?.style?.color ??
            seriesColor(index),
          kind: "category" as const
        }))
        : []
  );

  const selectLegend = (id: string, event: MouseEvent) => {
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    if (capabilities.legendDimension === "series") selection.series(chart, id, additive);
    else if (capabilities.legendDimension === "category") {
      selection.category(chart, id, additive);
    }
  };

  const hoverLegend = (id: string | undefined) => {
    if (capabilities.legendDimension === "series") hoveredSeriesId = id;
    else if (capabilities.legendDimension === "category") hoveredCategoryId = id;
  };

  const sideLegend = $derived(chart.legend.position === "start" || chart.legend.position === "end");
  const issues = $derived(chartIssues(chart));
</script>

<div
  class="chart-renderer"
  class:side={sideLegend}
  class:reverse={chart.legend.position === "start" || chart.legend.position === "top"}
  style:height={`${height}px`}
>
  {#if showTitle && chart.title}
    <div class="text-body-sm text-ink-primary chart-title truncate font-semibold">{chart.title}</div>
  {/if}

  <div class="chart-plot" bind:clientWidth={plotWidth} bind:clientHeight={plotHeight}>
    {#if issues.length > 0}
      <div class="text-caption text-danger-text flex h-full items-center justify-center p-4 text-center">
        Chart cannot render: {issues[0].message}
      </div>
    {:else if chart.type === "bar"}
      <PlotBars
        {chart}
        {selection}
        width={Math.max(1, plotWidth)}
        height={Math.max(1, plotHeight)}
        bind:hoveredSeriesId
        bind:ref
      />
    {:else if chart.type === "pie"}
      <PlotPie
        {chart}
        {selection}
        width={Math.max(1, plotWidth)}
        height={Math.max(1, plotHeight)}
        bind:hoveredCategoryId
        bind:ref
      />
    {:else if chart.type === "line" || chart.type === "area"}
      <PlotLines
        {chart}
        {selection}
        width={Math.max(1, plotWidth)}
        height={Math.max(1, plotHeight)}
        bind:hoveredSeriesId
        bind:ref
      />
    {:else if chart.type === "scatter" || chart.type === "bubble"}
      <PlotPoints
        {chart}
        {selection}
        width={Math.max(1, plotWidth)}
        height={Math.max(1, plotHeight)}
        bind:hoveredSeriesId
        bind:ref
      />
    {:else if chart.type === "waterfall"}
      <PlotWaterfall
        {chart}
        {selection}
        width={Math.max(1, plotWidth)}
        height={Math.max(1, plotHeight)}
        bind:ref
      />
    {:else if chart.type === "mekko"}
      <PlotMekko
        {chart}
        {selection}
        width={Math.max(1, plotWidth)}
        height={Math.max(1, plotHeight)}
        bind:hoveredSeriesId
        bind:ref
      />
    {:else if chart.type === "funnel"}
      <PlotFunnel
        {chart}
        {selection}
        width={Math.max(1, plotWidth)}
        height={Math.max(1, plotHeight)}
        bind:hoveredCategoryId
        bind:ref
      />
    {:else if chart.type === "radar"}
      <PlotRadar
        {chart}
        {selection}
        width={Math.max(1, plotWidth)}
        height={Math.max(1, plotHeight)}
        bind:hoveredSeriesId
        bind:ref
      />
    {:else if chart.type === "heatmap"}
      <PlotHeatmap
        {chart}
        {selection}
        width={Math.max(1, plotWidth)}
        height={Math.max(1, plotHeight)}
        bind:ref
      />
    {:else if chart.type === "treemap"}
      <PlotTreemap
        {chart}
        {selection}
        width={Math.max(1, plotWidth)}
        height={Math.max(1, plotHeight)}
        bind:hoveredCategoryId
        bind:ref
      />
    {/if}
  </div>

  {#if chart.legend.visible && legendEntries.length > 0 && issues.length === 0}
    <div class="chart-legend" class:vertical={sideLegend} aria-label="Chart legend">
      {#each legendEntries as entry (entry.id)}
        <button
          type="button"
          class="text-caption text-ink-secondary hover:bg-surface-panel-hover rounded-control flex min-w-0 cursor-pointer items-center gap-1.5 px-1.5 py-1"
          onpointerenter={() => hoverLegend(entry.id)}
          onpointerleave={() => hoverLegend(undefined)}
          onclick={(event) => selectLegend(entry.id, event)}
          title={`Select ${entry.label}`}
        >
          <span class="size-2.5 shrink-0 rounded-full" style:background={entry.color}></span>
          <span class="truncate">{entry.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .chart-renderer {
    display: grid;
    min-height: 0;
    min-width: 0;
    grid-template-rows: auto minmax(0, 1fr) auto;
  }

  .chart-renderer.reverse {
    grid-template-rows: auto auto minmax(0, 1fr);
  }

  .chart-title {
    padding: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 2) 0;
  }

  .chart-plot {
    grid-row: 2;
    min-width: 0;
    min-height: 0;
  }

  .chart-legend {
    display: flex;
    grid-row: 3;
    min-width: 0;
    flex-wrap: wrap;
    justify-content: center;
    gap: calc(var(--token-spacing-unit) * 0.5);
    padding: 0 calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 1.5);
  }

  .chart-renderer.reverse:not(.side) .chart-legend {
    grid-row: 2;
    padding-block: calc(var(--token-spacing-unit) * 1);
  }

  .chart-renderer.reverse:not(.side) .chart-plot {
    grid-row: 3;
  }

  .chart-renderer.side {
    grid-template-columns: minmax(0, 1fr) minmax(7rem, auto);
    grid-template-rows: auto minmax(0, 1fr);
  }

  .chart-renderer.side .chart-title {
    grid-column: 1 / -1;
  }

  .chart-renderer.side .chart-plot {
    grid-column: 1;
    grid-row: 2;
  }

  .chart-renderer.side .chart-legend {
    grid-column: 2;
    grid-row: 2;
  }

  .chart-renderer.side.reverse .chart-plot {
    grid-column: 2;
  }

  .chart-renderer.side.reverse .chart-legend {
    grid-column: 1;
  }

  .chart-legend.vertical {
    align-content: center;
    flex-direction: column;
    flex-wrap: nowrap;
    justify-content: center;
    padding: calc(var(--token-spacing-unit) * 2);
  }
</style>

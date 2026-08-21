<script lang="ts">
  import type { ChartTextElement, RadarChartModel } from "$json-store/types/data/chart";
  import { formatChartValue } from "$lib/unique-components/chart/chart-model";
  import type {
    ChartSelection,
    ChartSelectionTarget
  } from "$lib/unique-components/chart/chart-selection.svelte";
  import { layoutRadar } from "$lib/unique-components/chart/plot/layout-additional";
  import PlotTextElements from "./plot-text-elements.svelte";

  let {
    chart,
    selection,
    width = 1000,
    height = 300,
    hoveredSeriesId = $bindable(undefined),
    ref = $bindable(null)
  }: {
    chart: RadarChartModel;
    selection: ChartSelection;
    width?: number;
    height?: number;
    hoveredSeriesId?: string | undefined;
    ref?: SVGSVGElement | null;
  } = $props();

  const model = $derived(layoutRadar(chart, { width, height }));
  const textElements = $derived(
    chart.elements.filter((entry): entry is ChartTextElement => entry.kind === "text")
  );
  const additive = (event: MouseEvent | KeyboardEvent) =>
    event.shiftKey || event.metaKey || event.ctrlKey;
  const axisTarget = (axisId: string): ChartSelectionTarget => ({
    kind: "axis",
    chartId: chart.id,
    axisId
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg
  bind:this={ref}
  viewBox="0 0 {width} {height}"
  width="100%"
  height="100%"
  role="img"
  aria-label={chart.title === undefined ? "Radar chart" : `Radar chart: ${chart.title}`}
  onclick={(event) => {
    if (event.target === event.currentTarget) selection.clear();
  }}
  onkeydown={(event) => {
    if (event.key === "Escape") selection.clear();
  }}
  tabindex="-1"
  class="overflow-visible"
>
  <g
    role="button"
    tabindex="0"
    aria-label="Value axis"
    aria-pressed={selection.has(axisTarget(chart.axes.value.id))}
    onclick={(event) => {
      event.stopPropagation();
      selection.click(axisTarget(chart.axes.value.id), additive(event));
    }}
    onkeydown={(event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selection.click(axisTarget(chart.axes.value.id), additive(event));
    }}
    class="cursor-pointer outline-none"
  >
    {#each model.rings as ring, index (index)}
      <path
        d={ring}
        fill="none"
        class={selection.has(axisTarget(chart.axes.value.id))
          ? "stroke-active-border"
          : "stroke-border-subtle"}
        stroke-width={selection.has(axisTarget(chart.axes.value.id)) ? 2 : 1}
      />
    {/each}
  </g>

  <g
    role="button"
    tabindex="0"
    aria-label="Category axes"
    aria-pressed={selection.has(axisTarget(chart.axes.category.id))}
    onclick={(event) => {
      event.stopPropagation();
      selection.click(axisTarget(chart.axes.category.id), additive(event));
    }}
    onkeydown={(event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selection.click(axisTarget(chart.axes.category.id), additive(event));
    }}
    class="cursor-pointer outline-none"
  >
    {#each model.spokes as spoke (spoke.categoryId)}
      <line
        x1={model.center.x}
        y1={model.center.y}
        x2={spoke.x}
        y2={spoke.y}
        class={selection.has(axisTarget(chart.axes.category.id))
          ? "stroke-active-border"
          : "stroke-border-subtle"}
        stroke-width={selection.has(axisTarget(chart.axes.category.id)) ? 2 : 1}
      />
      <text
        x={spoke.labelX}
        y={spoke.labelY}
        text-anchor="middle"
        dominant-baseline="central"
        class="fill-ink-secondary"
        font-size="11"
        role="button"
        tabindex="0"
        onclick={(event) => {
          event.stopPropagation();
          selection.category(chart, spoke.categoryId, additive(event));
        }}
        onkeydown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          selection.category(chart, spoke.categoryId, additive(event));
        }}
      >{spoke.label}</text>
    {/each}
  </g>

  {#each model.polygons as polygon (polygon.seriesId)}
    <path
      d={polygon.path}
      fill={polygon.color}
      fill-opacity={hoveredSeriesId !== undefined && hoveredSeriesId !== polygon.seriesId
        ? chart.fillOpacity * 0.15
        : chart.fillOpacity}
      stroke={polygon.color}
      stroke-width="2"
      opacity={hoveredSeriesId !== undefined && hoveredSeriesId !== polygon.seriesId ? 0.25 : 1}
      role="button"
      tabindex="0"
      aria-label="Select series"
      onclick={(event) => {
        event.stopPropagation();
        selection.series(chart, polygon.seriesId, additive(event));
      }}
      onkeydown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selection.series(chart, polygon.seriesId, additive(event));
      }}
      onpointerenter={() => (hoveredSeriesId = polygon.seriesId)}
      onpointerleave={() => (hoveredSeriesId = undefined)}
      class="cursor-pointer outline-none"
    />
  {/each}

  {#each model.marks as mark (mark.id)}
    {@const chosen = selection.hasDatum(chart.id, mark.datumId)}
    <g
      role="button"
      tabindex="0"
      aria-label={`${mark.categoryLabel}, ${mark.seriesLabel}, ${formatChartValue(
        mark.value,
        chart.valueFormat
      )}`}
      aria-pressed={chosen}
      onpointerenter={() => (hoveredSeriesId = mark.seriesId)}
      onpointerleave={() => (hoveredSeriesId = undefined)}
      onclick={(event) => {
        event.stopPropagation();
        selection.mark(chart.id, mark, additive(event));
      }}
      onkeydown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selection.mark(chart.id, mark, additive(event));
      }}
      class="cursor-pointer outline-none"
    >
      <circle
        cx={mark.box.x + mark.box.width / 2}
        cy={mark.box.y + mark.box.height / 2}
        r="4.5"
        fill={mark.color}
        class={chosen ? "stroke-active-border" : "stroke-surface-panel"}
        stroke-width={chosen ? 3 : 1.5}
      />
      {#if chart.labels === "value"}
        <text
          x={mark.box.x + mark.box.width / 2}
          y={mark.box.y - 4}
          text-anchor="middle"
          class="fill-ink-secondary"
          font-size="10"
          pointer-events="none"
        >{formatChartValue(mark.value, chart.valueFormat)}</text>
      {/if}
    </g>
  {/each}

  <PlotTextElements
    chartId={chart.id}
    elements={textElements}
    {selection}
    {width}
    {height}
  />
</svg>

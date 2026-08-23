<script lang="ts">
  import type { ChartTextElement, HeatmapChartModel } from "$json-store/types/data/chart";
  import { formatChartValue } from "$lib/unique-components/chart/chart-model";
  import type {
    ChartSelection,
    ChartSelectionTarget
  } from "$lib/unique-components/chart/chart-selection.svelte";
  import { layoutHeatmap } from "$lib/unique-components/chart/plot/layout-additional";
  import PlotTextElements from "./plot-text-elements.svelte";

  let {
    chart,
    selection,
    width = 1000,
    height = 300,
    ref = $bindable(null)
  }: {
    chart: HeatmapChartModel;
    selection: ChartSelection;
    width?: number;
    height?: number;
    ref?: SVGSVGElement | null;
  } = $props();

  const PAD = { top: 18, right: 18, bottom: 42, left: 82 };
  const model = $derived(layoutHeatmap(chart, { width, height, pad: PAD }));
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
  aria-label={chart.title === undefined ? "Heatmap" : `Heatmap: ${chart.title}`}
  onclick={(event) => {
    if (event.target === event.currentTarget) selection.clear();
  }}
  onkeydown={(event) => {
    if (event.key === "Escape") selection.clear();
  }}
  tabindex="-1"
  class="overflow-visible"
>
  {#each model.cells as cell (cell.markId)}
    {@const mark = model.marks.find((entry) => entry.id === cell.markId)!}
    {@const chosen = selection.hasDatum(chart.id, mark.datumId)}
    <g
      role="button"
      tabindex="0"
      aria-label={`${mark.seriesLabel}, ${mark.categoryLabel}, ${formatChartValue(
        mark.value,
        chart.valueFormat
      )}`}
      aria-pressed={chosen}
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
      <rect
        x={mark.box.x}
        y={mark.box.y}
        width={mark.box.width}
        height={mark.box.height}
        fill={`color-mix(in srgb, ${chart.scale.lowColor} ${Math.round(
          (1 - cell.intensity) * 100
        )}%, ${mark.color})`}
        opacity={mark.opacity}
        class={chosen ? "stroke-active-border" : "stroke-surface-panel"}
        stroke-width={chosen ? 3 : 1.5}
      >
        <title>{mark.seriesLabel} · {mark.categoryLabel} · {mark.value}</title>
      </rect>
      {#if (chart.labels === "value" || (chart.labels === "custom" && mark.label)) && mark.box.width > 34 && mark.box.height > 20}
        <text
          x={mark.box.x + mark.box.width / 2}
          y={mark.box.y + mark.box.height / 2}
          text-anchor="middle"
          dominant-baseline="central"
          class={cell.intensity > 0.58 ? "fill-ink-on-fill" : "fill-ink-primary"}
          font-size="11"
          pointer-events="none"
        >{chart.labels === "custom"
          ? mark.label
          : formatChartValue(mark.value, chart.valueFormat)}</text>
      {/if}
    </g>
  {/each}

  {#if chart.axes.category.visible}
    <g
      role="button"
      tabindex="0"
      aria-label="Category axis"
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
      {#each model.categoryBands as band (band.categoryId)}
        <text
          x={band.box.x + band.box.width / 2}
          y={height - PAD.bottom + 18}
          text-anchor="middle"
          class="fill-ink-secondary"
          font-size="11"
          role="button"
          tabindex="0"
          onclick={(event) => {
            event.stopPropagation();
            selection.category(chart, band.categoryId, additive(event));
          }}
          onkeydown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            selection.category(chart, band.categoryId, additive(event));
          }}
        >{band.label}</text>
      {/each}
    </g>
  {/if}

  {#if chart.axes.series.visible}
    <g
      role="button"
      tabindex="0"
      aria-label="Series axis"
      aria-pressed={selection.has(axisTarget(chart.axes.series.id))}
      onclick={(event) => {
        event.stopPropagation();
        selection.click(axisTarget(chart.axes.series.id), additive(event));
      }}
      onkeydown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selection.click(axisTarget(chart.axes.series.id), additive(event));
      }}
      class="cursor-pointer outline-none"
    >
      {#each model.seriesBands as band (band.seriesId)}
        <text
          x={PAD.left - 8}
          y={band.box.y + band.box.height / 2}
          text-anchor="end"
          dominant-baseline="central"
          class="fill-ink-secondary"
          font-size="11"
          role="button"
          tabindex="0"
          onclick={(event) => {
            event.stopPropagation();
            selection.series(chart, band.seriesId, additive(event));
          }}
          onkeydown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            selection.series(chart, band.seriesId, additive(event));
          }}
        >{band.label}</text>
      {/each}
    </g>
  {/if}

  <PlotTextElements
    chartId={chart.id}
    elements={textElements}
    {selection}
    {width}
    {height}
  />
</svg>

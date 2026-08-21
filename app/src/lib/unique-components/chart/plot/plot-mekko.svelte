<script lang="ts">
  import type { ChartTextElement, MekkoChartModel } from "$json-store/types/data/chart";
  import { formatChartValue } from "$lib/unique-components/chart/chart-model";
  import type {
    ChartSelection,
    ChartSelectionTarget
  } from "$lib/unique-components/chart/chart-selection.svelte";
  import {
    layoutMekko,
    lineForCategoryAxis
  } from "$lib/unique-components/chart/plot/layout-additional";
  import PlotTextElements from "./plot-text-elements.svelte";

  let {
    chart,
    selection,
    width = 1000,
    height = 300,
    hoveredSeriesId = $bindable(undefined),
    ref = $bindable(null)
  }: {
    chart: MekkoChartModel;
    selection: ChartSelection;
    width?: number;
    height?: number;
    hoveredSeriesId?: string | undefined;
    ref?: SVGSVGElement | null;
  } = $props();

  const PAD = { top: 18, right: 16, bottom: 48, left: 54 };
  const model = $derived(layoutMekko(chart, { width, height, pad: PAD }));
  const textElements = $derived(
    chart.elements.filter((entry): entry is ChartTextElement => entry.kind === "text")
  );
  const categoryTotals = $derived(
    new Map(
      chart.data.categories.map((category) => [
        category.id,
        chart.data.datums
          .filter((datum) => datum.categoryId === category.id)
          .reduce((sum, datum) => sum + Math.max(0, datum.value), 0)
      ])
    )
  );
  const additive = (event: MouseEvent | KeyboardEvent) =>
    event.shiftKey || event.metaKey || event.ctrlKey;
  const axisTarget = (axisId: string): ChartSelectionTarget => ({
    kind: "axis",
    chartId: chart.id,
    axisId
  });
  const elementTarget = (elementId: string): ChartSelectionTarget => ({
    kind: "element",
    chartId: chart.id,
    elementId
  });
  const labelFor = (mark: (typeof model.marks)[number]) => {
    if (chart.labels === "value") return formatChartValue(mark.value, chart.valueFormat);
    if (chart.labels === "percent") {
      return formatChartValue(mark.value / (categoryTotals.get(mark.categoryId) || 1), {
        style: "percent",
        maximumFractionDigits: 0
      });
    }
    return undefined;
  };
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg
  bind:this={ref}
  viewBox="0 0 {width} {height}"
  width="100%"
  height="100%"
  role="img"
  aria-label={chart.title === undefined ? "Mekko chart" : `Mekko chart: ${chart.title}`}
  onclick={(event) => {
    if (event.target === event.currentTarget) selection.clear();
  }}
  onkeydown={(event) => {
    if (event.key === "Escape") selection.clear();
  }}
  tabindex="-1"
  class="overflow-visible"
>
  {#if chart.axes.value.grid}
    {#each model.ticks as tick (tick.value)}
      <line
        x1={model.plot.x}
        y1={tick.at}
        x2={model.plot.x + model.plot.width}
        y2={tick.at}
        class="stroke-border-subtle"
        stroke-width="1"
        pointer-events="none"
      />
    {/each}
  {/if}

  {#each model.marks as mark (mark.id)}
    {@const chosen = selection.hasDatum(chart.id, mark.datumId)}
    {@const label = labelFor(mark)}
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
      <rect
        x={mark.box.x}
        y={mark.box.y}
        width={Math.max(0, mark.box.width)}
        height={Math.max(0, mark.box.height)}
        fill={mark.color}
        opacity={hoveredSeriesId !== undefined && hoveredSeriesId !== mark.seriesId
          ? mark.opacity * 0.2
          : mark.opacity}
        class={chosen ? "stroke-active-border" : "stroke-surface-panel"}
        stroke-width={chosen ? 3 : 1}
      >
        <title>{mark.categoryLabel} · {mark.seriesLabel} · {label ?? mark.value}</title>
      </rect>
      {#if label !== undefined && mark.box.height > 22 && mark.box.width > 42}
        <text
          x={mark.box.x + mark.box.width / 2}
          y={mark.box.y + mark.box.height / 2}
          text-anchor="middle"
          dominant-baseline="central"
          class="fill-ink-on-fill"
          font-size="12"
          pointer-events="none"
        >{label}</text>
      {/if}
    </g>
  {/each}

  {#each chart.elements as element (element.id)}
    {#if element.kind === "axis-line"}
      {@const line = lineForCategoryAxis(
        { category: chart.axes.category.id, value: chart.axes.value.id },
        model,
        element
      )}
      {@const target = elementTarget(element.id)}
      {@const chosen = selection.has(target)}
      {#if line}
        <g
          role="button"
          tabindex="0"
          aria-label={element.label ?? "Reference line"}
          aria-pressed={chosen}
          onclick={(event) => {
            event.stopPropagation();
            selection.click(target, additive(event));
          }}
          onkeydown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            selection.click(target, additive(event));
          }}
          class="cursor-pointer outline-none"
        >
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="transparent"
            stroke-width="12"
          />
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            class={chosen ? "stroke-active-border" : "stroke-ink-secondary"}
            stroke-width={chosen ? 3 : 2}
            stroke-dasharray="7 5"
            pointer-events="none"
          />
          {#if element.label}
            <text x={line.labelX} y={line.labelY} class="fill-ink-secondary" font-size="12">
              {element.label}
            </text>
          {/if}
        </g>
      {/if}
    {/if}
  {/each}

  {#if chart.axes.value.visible}
    <g
      role="button"
      tabindex="0"
      aria-label="Share axis"
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
      {#each model.ticks as tick (tick.value)}
        <text
          x={PAD.left - 7}
          y={tick.at + 4}
          text-anchor="end"
          class="fill-ink-muted"
          font-size="11"
        >{formatChartValue(tick.value, { style: "percent", maximumFractionDigits: 0 })}</text>
      {/each}
    </g>
  {/if}

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
      {#each model.bands as band (band.categoryId)}
        <text
          x={band.box.x + band.box.width / 2}
          y={height - PAD.bottom + 17}
          text-anchor="middle"
          class="fill-ink-secondary"
          font-size="12"
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
        <text
          x={band.box.x + band.box.width / 2}
          y={height - PAD.bottom + 31}
          text-anchor="middle"
          class="fill-ink-muted"
          font-size="10"
          pointer-events="none"
        >{formatChartValue(band.share, { style: "percent", maximumFractionDigits: 0 })}</text>
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

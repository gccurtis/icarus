<script lang="ts">
  import type {
    BubbleChartModel,
    ChartTextElement,
    ScatterChartModel
  } from "$json-store/types/data/chart";
  import { formatChartValue } from "$lib/unique-components/chart/chart-model";
  import type {
    ChartSelection,
    ChartSelectionTarget
  } from "$lib/unique-components/chart/chart-selection.svelte";
  import {
    layoutPoints,
    lineForNumericAxis,
    lineForTrend
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
    chart: ScatterChartModel | BubbleChartModel;
    selection: ChartSelection;
    width?: number;
    height?: number;
    hoveredSeriesId?: string | undefined;
    ref?: SVGSVGElement | null;
  } = $props();

  const PAD = { top: 24, right: 22, bottom: 42, left: 64 };
  const model = $derived(layoutPoints(chart, { width, height, pad: PAD }));
  const textElements = $derived(
    chart.elements.filter((entry): entry is ChartTextElement => entry.kind === "text")
  );
  const formatY = (value: number) =>
    formatChartValue(value, chart.axes.y.format ?? chart.valueFormat);
  const formatX = (value: number) => formatChartValue(value, chart.axes.x.format);
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
  const dimmed = (seriesId: string) =>
    hoveredSeriesId !== undefined && hoveredSeriesId !== seriesId;
  const labelFor = (mark: (typeof model.marks)[number]) => {
    if (chart.labels === "category") return mark.categoryLabel;
    if (chart.labels === "value") return formatY(mark.value);
    if (chart.labels === "custom") return mark.label;
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
  aria-label={chart.title === undefined
    ? `${chart.type} chart`
    : `${chart.type} chart: ${chart.title}`}
  onclick={(event) => {
    if (event.target === event.currentTarget) selection.clear();
  }}
  onkeydown={(event) => {
    if (event.key === "Escape") selection.clear();
  }}
  tabindex="-1"
  class="overflow-visible"
>
  {#if chart.axes.x.grid}
    {#each model.xTicks as tick (tick.value)}
      <line
        x1={tick.at}
        y1={model.plot.y}
        x2={tick.at}
        y2={model.plot.y + model.plot.height}
        class="stroke-border-subtle"
        stroke-width="1"
        pointer-events="none"
      />
    {/each}
  {/if}
  {#if chart.axes.y.grid}
    {#each model.yTicks as tick (tick.value)}
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

  {#each model.points as point (point.markId)}
    {@const mark = model.marks.find((entry) => entry.id === point.markId)!}
    {@const chosen = selection.hasDatum(chart.id, mark.datumId)}
    {@const label = labelFor(mark)}
    <g
      role="button"
      tabindex="0"
      aria-label={`${mark.categoryLabel}, ${mark.seriesLabel}, x ${formatX(
        chart.data.datums.find((entry) => entry.id === mark.datumId)?.x ?? 0
      )}, y ${formatY(mark.value)}`}
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
        cx={point.x}
        cy={point.y}
        r={point.radius}
        fill={mark.color}
        opacity={dimmed(mark.seriesId) ? mark.opacity * 0.2 : mark.opacity * 0.82}
        class={chosen ? "stroke-active-border" : "stroke-surface-panel"}
        stroke-width={chosen ? 3 : 1.5}
      >
        <title>{mark.categoryLabel} · {mark.seriesLabel} · {formatY(mark.value)}</title>
      </circle>
      {#if label !== undefined}
        <text
          x={point.x}
          y={point.y - point.radius - 5}
          text-anchor="middle"
          class="fill-ink-secondary"
          font-size="11"
          pointer-events="none"
        >{label}</text>
      {/if}
    </g>
  {/each}

  {#each chart.elements as element (element.id)}
    {@const chosen = selection.has(elementTarget(element.id))}
    {#if element.kind === "axis-line"}
      {@const line = lineForNumericAxis(chart, model, element)}
      {#if line}
        <g
          role="button"
          tabindex="0"
          aria-label={element.label ?? "Reference line"}
          aria-pressed={chosen}
          onclick={(event) => {
            event.stopPropagation();
            selection.click(elementTarget(element.id), additive(event));
          }}
          onkeydown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            selection.click(elementTarget(element.id), additive(event));
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
            <text
              x={line.labelX}
              y={line.labelY}
              class="fill-ink-secondary"
              font-size="12"
              pointer-events="none"
            >{element.label}</text>
          {/if}
        </g>
      {/if}
    {:else if element.kind === "trend-line"}
      {@const line = lineForTrend(chart, model, element)}
      {#if line}
        <g
          role="button"
          tabindex="0"
          aria-label={element.label ?? "Linear trend"}
          aria-pressed={chosen}
          onclick={(event) => {
            event.stopPropagation();
            selection.click(elementTarget(element.id), additive(event));
          }}
          onkeydown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            selection.click(elementTarget(element.id), additive(event));
          }}
          class="cursor-pointer outline-none"
        >
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="transparent"
            stroke-width="14"
          />
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            class={chosen ? "stroke-active-border" : "stroke-intelligence-fill"}
            stroke-width={chosen ? 4 : 3}
            pointer-events="none"
          />
          <text
            x={line.labelX}
            y={line.labelY}
            text-anchor="middle"
            class="fill-intelligence-text"
            font-size="11"
            font-weight="600"
            pointer-events="none"
          >
            {element.label ?? "Trend"}{element.showEquation ? ` · ${line.equation}` : ""}{element.showRSquared
              ? ` · R² ${line.rSquared.toFixed(2)}`
              : ""}
          </text>
        </g>
      {/if}
    {/if}
  {/each}

  {#if chart.axes.y.visible}
    <g
      role="button"
      tabindex="0"
      aria-label="Y axis"
      aria-pressed={selection.has(axisTarget(chart.axes.y.id))}
      onclick={(event) => {
        event.stopPropagation();
        selection.click(axisTarget(chart.axes.y.id), additive(event));
      }}
      onkeydown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selection.click(axisTarget(chart.axes.y.id), additive(event));
      }}
      class="cursor-pointer outline-none"
    >
      <line
        x1={model.plot.x}
        y1={model.plot.y}
        x2={model.plot.x}
        y2={model.plot.y + model.plot.height}
        class={selection.has(axisTarget(chart.axes.y.id))
          ? "stroke-active-border"
          : "stroke-border-strong"}
        stroke-width={selection.has(axisTarget(chart.axes.y.id)) ? 2 : 1}
      />
      {#each model.yTicks as tick (tick.value)}
        <text
          x={PAD.left - 8}
          y={tick.at + 4}
          text-anchor="end"
          class="fill-ink-muted"
          font-size="12"
        >{formatY(tick.value)}</text>
      {/each}
    </g>
  {/if}

  {#if chart.axes.x.visible}
    <g
      role="button"
      tabindex="0"
      aria-label="X axis"
      aria-pressed={selection.has(axisTarget(chart.axes.x.id))}
      onclick={(event) => {
        event.stopPropagation();
        selection.click(axisTarget(chart.axes.x.id), additive(event));
      }}
      onkeydown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selection.click(axisTarget(chart.axes.x.id), additive(event));
      }}
      class="cursor-pointer outline-none"
    >
      <line
        x1={model.plot.x}
        y1={model.plot.y + model.plot.height}
        x2={model.plot.x + model.plot.width}
        y2={model.plot.y + model.plot.height}
        class={selection.has(axisTarget(chart.axes.x.id))
          ? "stroke-active-border"
          : "stroke-border-strong"}
        stroke-width={selection.has(axisTarget(chart.axes.x.id)) ? 2 : 1}
      />
      {#each model.xTicks as tick (tick.value)}
        <text
          x={tick.at}
          y={height - PAD.bottom + 18}
          text-anchor="middle"
          class="fill-ink-muted"
          font-size="12"
        >{formatX(tick.value)}</text>
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

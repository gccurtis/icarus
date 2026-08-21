<script lang="ts">
  import type {
    AreaChartModel,
    ChartTextElement,
    LineChartModel
  } from "$json-store/types/data/chart";
  import { formatChartValue } from "$lib/unique-components/chart/chart-model";
  import type {
    ChartSelection,
    ChartSelectionTarget
  } from "$lib/unique-components/chart/chart-selection.svelte";
  import {
    cagrForCategorySeries,
    layoutCategorySeries,
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
    chart: LineChartModel | AreaChartModel;
    selection: ChartSelection;
    width?: number;
    height?: number;
    hoveredSeriesId?: string | undefined;
    ref?: SVGSVGElement | null;
  } = $props();

  const PAD = { top: 24, right: 18, bottom: 40, left: 64 };
  const model = $derived(layoutCategorySeries(chart, { width, height, pad: PAD }));
  const textElements = $derived(
    chart.elements.filter((entry): entry is ChartTextElement => entry.kind === "text")
  );
  const format = (value: number) => formatChartValue(value, chart.valueFormat);
  const tickText = (value: number) =>
    chart.type === "area" && chart.layout === "expand"
      ? formatChartValue(value, { style: "percent", maximumFractionDigits: 0 })
      : formatChartValue(value, chart.axes.value.format ?? chart.valueFormat);
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

  {#each model.series as series (series.seriesId)}
    {@const faded = dimmed(series.seriesId)}
    {#if chart.type === "area" && series.areaPath}
      <path
        d={series.areaPath}
        fill={series.color}
        opacity={faded ? chart.opacity * 0.2 : chart.opacity}
        pointer-events="none"
      />
    {/if}
    <path
      d={series.path}
      fill="none"
      stroke={series.color}
      stroke-width="2.5"
      opacity={faded ? 0.2 : 1}
      pointer-events="none"
    />
    <path
      d={series.path}
      fill="none"
      stroke="transparent"
      stroke-width="14"
      role="button"
      tabindex="0"
      aria-label={`Select ${series.label} series`}
      onclick={(event) => {
        event.stopPropagation();
        selection.series(chart, series.seriesId, additive(event));
      }}
      onkeydown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selection.series(chart, series.seriesId, additive(event));
      }}
      onpointerenter={() => (hoveredSeriesId = series.seriesId)}
      onpointerleave={() => (hoveredSeriesId = undefined)}
      class="cursor-pointer outline-none"
    />
  {/each}

  {#each model.marks as mark (mark.id)}
    {@const chosen = selection.hasDatum(chart.id, mark.datumId)}
    <g
      role="button"
      tabindex="0"
      aria-label={`${mark.categoryLabel}, ${mark.seriesLabel}, ${format(mark.value)}`}
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
        r={chart.type === "line" && chart.points === "none" && !chosen ? 7 : 4.5}
        fill={chart.type === "line" && chart.points === "none" && !chosen ? "transparent" : mark.color}
        opacity={dimmed(mark.seriesId) ? mark.opacity * 0.2 : mark.opacity}
        class={chosen
          ? "stroke-active-border"
          : chart.type === "line" && chart.points === "none"
            ? "stroke-transparent"
            : "stroke-surface-panel"}
        stroke-width={chosen ? 3 : 1.5}
      >
        <title>{mark.categoryLabel} · {mark.seriesLabel} · {format(mark.value)}</title>
      </circle>
      {#if chart.labels === "value"}
        <text
          x={mark.box.x + mark.box.width / 2}
          y={mark.box.y - 4}
          text-anchor="middle"
          class="fill-ink-secondary"
          font-size="11"
          pointer-events="none"
        >{format(mark.value)}</text>
      {/if}
    </g>
  {/each}

  {#each chart.elements as element (element.id)}
    {@const chosen = selection.has(elementTarget(element.id))}
    {#if element.kind === "axis-line"}
      {@const line = lineForCategoryAxis(
        { category: chart.axes.category.id, value: chart.axes.value.id },
        model,
        element
      )}
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
    {:else if element.kind === "cagr-line"}
      {@const line = cagrForCategorySeries(chart, model, element)}
      {#if line}
        <g
          role="button"
          tabindex="0"
          aria-label={element.label ?? "CAGR line"}
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
            font-size="12"
            font-weight="600"
            pointer-events="none"
          >
            {element.label ?? "CAGR"}{element.showRate
              ? ` ${formatChartValue(line.rate, {
                  style: "percent",
                  maximumFractionDigits: 1
                })}`
              : ""}
          </text>
        </g>
      {/if}
    {/if}
  {/each}

  {#if chart.axes.value.visible}
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
      <line
        x1={model.plot.x}
        y1={model.plot.y}
        x2={model.plot.x}
        y2={model.plot.y + model.plot.height}
        class={selection.has(axisTarget(chart.axes.value.id))
          ? "stroke-active-border"
          : "stroke-border-strong"}
        stroke-width={selection.has(axisTarget(chart.axes.value.id)) ? 2 : 1}
      />
      {#each model.ticks as tick (tick.value)}
        <text
          x={PAD.left - 8}
          y={tick.at + 4}
          text-anchor="end"
          class="fill-ink-muted"
          font-size="12"
        >{tickText(tick.value)}</text>
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
      <line
        x1={model.plot.x}
        y1={model.plot.y + model.plot.height}
        x2={model.plot.x + model.plot.width}
        y2={model.plot.y + model.plot.height}
        class={selection.has(axisTarget(chart.axes.category.id))
          ? "stroke-active-border"
          : "stroke-border-strong"}
        stroke-width={selection.has(axisTarget(chart.axes.category.id)) ? 2 : 1}
      />
      {#each model.bands as band (band.categoryId)}
        <text
          x={band.box.x + band.box.width / 2}
          y={height - PAD.bottom + 18}
          text-anchor="middle"
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
          class="fill-ink-secondary cursor-pointer"
          font-size="12"
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

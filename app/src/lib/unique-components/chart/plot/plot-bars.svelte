<script lang="ts">
  import type { BarChartModel } from "$json-store/types/data/chart";
  import { formatChartValue } from "$lib/unique-components/chart/chart-model";
  import type { ChartSelection, ChartSelectionTarget } from "$lib/unique-components/chart/chart-selection.svelte";
  import {
    layoutBars,
    lineForAxisElement,
    lineForCagr,
    placeTotalLabels,
    placeValueLabels
  } from "$lib/unique-components/chart/plot/layout";

  let {
    chart,
    selection,
    width = 1000,
    height = 300,
    hoveredSeriesId = $bindable(undefined),
    ref = $bindable(null)
  }: {
    chart: BarChartModel;
    selection: ChartSelection;
    width?: number;
    height?: number;
    hoveredSeriesId?: string | undefined;
    ref?: SVGSVGElement | null;
  } = $props();

  const PAD = { top: 24, right: 18, bottom: 40, left: 64 };
  const model = $derived(layoutBars(chart, { width, height, pad: PAD }));
  const format = (value: number) => formatChartValue(value, chart.valueFormat);
  const horizontal = $derived(chart.orientation === "horizontal");
  const valueLabels = $derived(
    chart.labels === "value" || chart.labels === "custom"
      ? placeValueLabels(
          model.marks,
          chart.layout,
          horizontal,
          chart.labels === "custom" ? (_, mark) => mark.label ?? "" : format,
          chart.labels === "custom"
        )
      : []
  );
  const totalLabels = $derived(
    chart.labels === "total" ? placeTotalLabels(model.marks, model.bands, horizontal, format) : []
  );
  const dimmed = (seriesId: string) =>
    hoveredSeriesId !== undefined && hoveredSeriesId !== seriesId;
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
  const tickText = (value: number) =>
    chart.layout === "expand"
      ? formatChartValue(value, { style: "percent", maximumFractionDigits: 0 })
      : formatChartValue(value, chart.axes.value.format ?? chart.valueFormat);
</script>

<!-- The background clears only chart-part selection; a containing frame can still remain selected. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg
  bind:this={ref}
  viewBox="0 0 {width} {height}"
  width="100%"
  height="100%"
  role="img"
  aria-label={chart.title === undefined ? "Bar chart" : `Bar chart: ${chart.title}`}
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
        x1={horizontal ? tick.at : model.plot.x}
        y1={horizontal ? model.plot.y : tick.at}
        x2={horizontal ? tick.at : model.plot.x + model.plot.width}
        y2={horizontal ? model.plot.y + model.plot.height : tick.at}
        class="stroke-border-subtle"
        stroke-width="1"
        pointer-events="none"
      />
    {/each}
  {/if}

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
        x1={horizontal ? model.plot.x : model.plot.x}
        y1={horizontal ? model.plot.y + model.plot.height : model.plot.y}
        x2={horizontal ? model.plot.x + model.plot.width : model.plot.x}
        y2={horizontal ? model.plot.y + model.plot.height : model.plot.y + model.plot.height}
        class={selection.has(axisTarget(chart.axes.value.id)) ? "stroke-active-border" : "stroke-border-strong"}
        stroke-width={selection.has(axisTarget(chart.axes.value.id)) ? 2 : 1}
      />
      {#each model.ticks as tick (tick.value)}
        <text
          x={horizontal ? tick.at : PAD.left - 8}
          y={horizontal ? height - PAD.bottom + 18 : tick.at + 4}
          text-anchor={horizontal ? "middle" : "end"}
          class="fill-ink-muted"
          font-size="12"
        >{tickText(tick.value)}</text>
      {/each}
      {#if chart.axes.value.title}
        <text
          x={horizontal ? model.plot.x + model.plot.width / 2 : 14}
          y={horizontal ? height - 4 : model.plot.y + model.plot.height / 2}
          text-anchor="middle"
          transform={horizontal ? undefined : `rotate(-90 14 ${model.plot.y + model.plot.height / 2})`}
          class="fill-ink-secondary"
          font-size="12"
        >{chart.axes.value.title}</text>
      {/if}
    </g>
  {/if}

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
      <rect
        x={mark.box.x}
        y={mark.box.y}
        width={Math.max(0, mark.box.width)}
        height={Math.max(0, mark.box.height)}
        fill={mark.color}
        opacity={dimmed(mark.seriesId) ? mark.opacity * 0.2 : mark.opacity}
        class="stroke-surface-panel"
        stroke-width="1"
      >
        <title>{mark.categoryLabel} · {mark.seriesLabel} · {format(mark.value)}</title>
      </rect>
      {#if chosen}
        <rect
          x={mark.box.x - 2}
          y={mark.box.y - 2}
          width={Math.max(0, mark.box.width + 4)}
          height={Math.max(0, mark.box.height + 4)}
          fill="none"
          class="stroke-active-border"
          stroke-width="3"
          rx="2"
          pointer-events="none"
        />
      {/if}
    </g>
  {/each}

  {#each chart.elements as element (element.id)}
    {@const chosen = selection.has(elementTarget(element.id))}
    {#if element.kind === "axis-line"}
      {@const line = lineForAxisElement(chart, model, element)}
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
            x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
            stroke="transparent"
            stroke-width="12"
          />
          <line
            x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
            class={chosen ? "stroke-active-border" : "stroke-ink-secondary"}
            stroke-width={chosen ? 3 : 2}
            stroke-dasharray="7 5"
            pointer-events="none"
          />
          {#if element.label}
            <text x={line.labelX} y={line.labelY} class="fill-ink-secondary" font-size="12" pointer-events="none">
              {element.label}
            </text>
          {/if}
        </g>
      {/if}
    {:else if element.kind === "cagr-line"}
      {@const line = lineForCagr(chart, model, element)}
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
          <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="transparent" stroke-width="14" />
          <line
            x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
            class={chosen ? "stroke-active-border" : "stroke-intelligence-fill"}
            stroke-width={chosen ? 4 : 3}
            pointer-events="none"
          />
          <circle cx={line.x1} cy={line.y1} r="4" class="fill-intelligence-fill" pointer-events="none" />
          <circle cx={line.x2} cy={line.y2} r="4" class="fill-intelligence-fill" pointer-events="none" />
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
              ? ` ${formatChartValue(line.rate, { style: "percent", maximumFractionDigits: 1 })}`
              : ""}
          </text>
        </g>
      {/if}
    {:else}
      <text
        x={element.position.x * width}
        y={element.position.y * height}
        role="button"
        tabindex="0"
        aria-pressed={chosen}
        class={chosen ? "fill-active-text cursor-pointer font-semibold" : "fill-ink-primary cursor-pointer"}
        font-size="13"
        onclick={(event) => {
          event.stopPropagation();
          selection.click(elementTarget(element.id), additive(event));
        }}
        onkeydown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          selection.click(elementTarget(element.id), additive(event));
        }}
      >{element.text}</text>
    {/if}
  {/each}

  {#each valueLabels as label (label.markId)}
    <text
      x={label.x}
      y={label.y}
      text-anchor={horizontal && !label.inside ? "start" : "middle"}
      dominant-baseline={label.inside || horizontal ? "central" : "auto"}
      class={label.inside ? "fill-ink-on-fill" : "fill-ink-secondary"}
      font-size="12"
      pointer-events="none"
    >{label.text}</text>
  {/each}

  {#each totalLabels as label (label.markId)}
    <text
      x={label.x}
      y={label.y}
      text-anchor={horizontal ? "start" : "middle"}
      dominant-baseline={horizontal ? "central" : "auto"}
      class="fill-ink-primary"
      font-size="12"
      font-weight="600"
      pointer-events="none"
    >{label.text}</text>
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
    >
      <line
        x1={horizontal ? model.plot.x : model.plot.x}
        y1={horizontal ? model.plot.y : model.plot.y + model.plot.height}
        x2={horizontal ? model.plot.x : model.plot.x + model.plot.width}
        y2={horizontal ? model.plot.y + model.plot.height : model.plot.y + model.plot.height}
        class={selection.has(axisTarget(chart.axes.category.id)) ? "stroke-active-border" : "stroke-border-strong"}
        stroke-width={selection.has(axisTarget(chart.axes.category.id)) ? 2 : 1}
      />
      {#each model.bands as band (band.categoryId)}
        <text
          x={horizontal ? PAD.left - 8 : band.box.x + band.box.width / 2}
          y={horizontal ? band.box.y + band.box.height / 2 + 4 : height - PAD.bottom + 18}
          text-anchor={horizontal ? "end" : "middle"}
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
      {#if chart.axes.category.title}
        <text
          x={horizontal ? 14 : model.plot.x + model.plot.width / 2}
          y={horizontal ? model.plot.y + model.plot.height / 2 : height - 4}
          text-anchor="middle"
          transform={horizontal ? `rotate(-90 14 ${model.plot.y + model.plot.height / 2})` : undefined}
          class="fill-ink-secondary"
          font-size="12"
        >{chart.axes.category.title}</text>
      {/if}
    </g>
  {/if}
</svg>

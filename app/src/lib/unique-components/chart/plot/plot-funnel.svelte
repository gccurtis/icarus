<script lang="ts">
  import type { ChartTextElement, FunnelChartModel } from "$json-store/types/data/chart";
  import { formatChartValue } from "$lib/unique-components/chart/chart-model";
  import type { ChartSelection } from "$lib/unique-components/chart/chart-selection.svelte";
  import { layoutFunnel } from "$lib/unique-components/chart/plot/layout-additional";
  import PlotTextElements from "./plot-text-elements.svelte";

  let {
    chart,
    selection,
    width = 1000,
    height = 300,
    hoveredCategoryId = $bindable(undefined),
    ref = $bindable(null)
  }: {
    chart: FunnelChartModel;
    selection: ChartSelection;
    width?: number;
    height?: number;
    hoveredCategoryId?: string | undefined;
    ref?: SVGSVGElement | null;
  } = $props();

  const model = $derived(layoutFunnel(chart, { width, height }));
  const textElements = $derived(
    chart.elements.filter((entry): entry is ChartTextElement => entry.kind === "text")
  );
  const additive = (event: MouseEvent | KeyboardEvent) =>
    event.shiftKey || event.metaKey || event.ctrlKey;
  const labelFor = (mark: (typeof model.marks)[number]) => {
    switch (chart.labels) {
      case "none":
        return undefined;
      case "category":
        return mark.categoryLabel;
      case "value":
        return formatChartValue(mark.value, chart.valueFormat);
      case "percent":
        return formatChartValue(mark.value / (model.first || 1), {
          style: "percent",
          maximumFractionDigits: 0
        });
    }
  };
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg
  bind:this={ref}
  viewBox="0 0 {width} {height}"
  width="100%"
  height="100%"
  role="img"
  aria-label={chart.title === undefined ? "Funnel chart" : `Funnel chart: ${chart.title}`}
  onclick={(event) => {
    if (event.target === event.currentTarget) selection.clear();
  }}
  onkeydown={(event) => {
    if (event.key === "Escape") selection.clear();
  }}
  tabindex="-1"
  class="overflow-visible"
>
  {#each model.stages as stage, index (stage.markId)}
    {@const mark = model.marks[index]}
    {@const chosen = selection.hasDatum(chart.id, mark.datumId)}
    {@const label = labelFor(mark)}
    <g
      role="button"
      tabindex="0"
      aria-label={`${mark.categoryLabel}, ${formatChartValue(mark.value, chart.valueFormat)}`}
      aria-pressed={chosen}
      onpointerenter={() => (hoveredCategoryId = mark.categoryId)}
      onpointerleave={() => (hoveredCategoryId = undefined)}
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
      opacity={hoveredCategoryId !== undefined && hoveredCategoryId !== mark.categoryId
        ? mark.opacity * 0.2
        : mark.opacity}
    >
      <path
        d={stage.path}
        fill={mark.color}
        class={chosen ? "stroke-active-border" : "stroke-surface-panel"}
        stroke-width={chosen ? 3 : 2}
      >
        <title>{mark.categoryLabel} · {formatChartValue(mark.value, chart.valueFormat)}</title>
      </path>
      {#if label !== undefined && mark.box.height > 20 && mark.box.width > 52}
        <text
          x={stage.center.x}
          y={stage.center.y}
          text-anchor="middle"
          dominant-baseline="central"
          class="fill-ink-on-fill"
          font-size="12"
          pointer-events="none"
        >{label}</text>
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

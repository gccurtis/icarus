<script lang="ts">
  import type { ChartTextElement, TreemapChartModel } from "$json-store/types/data/chart";
  import { formatChartValue } from "$lib/unique-components/chart/chart-model";
  import type { ChartSelection } from "$lib/unique-components/chart/chart-selection.svelte";
  import { layoutTreemap } from "$lib/unique-components/chart/plot/layout-additional";
  import PlotTextElements from "./plot-text-elements.svelte";

  let {
    chart,
    selection,
    width = 1000,
    height = 300,
    hoveredCategoryId = $bindable(undefined),
    ref = $bindable(null)
  }: {
    chart: TreemapChartModel;
    selection: ChartSelection;
    width?: number;
    height?: number;
    hoveredCategoryId?: string | undefined;
    ref?: SVGSVGElement | null;
  } = $props();

  const model = $derived(layoutTreemap(chart, { width, height }));
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
      case "custom":
        return mark.label;
      case "percent":
        return formatChartValue(mark.value / (model.total || 1), {
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
  aria-label={chart.title === undefined ? "Treemap" : `Treemap: ${chart.title}`}
  onclick={(event) => {
    if (event.target === event.currentTarget) selection.clear();
  }}
  onkeydown={(event) => {
    if (event.key === "Escape") selection.clear();
  }}
  tabindex="-1"
  class="overflow-visible"
>
  {#if model.total <= 0}
    <text
      x={width / 2}
      y={height / 2}
      text-anchor="middle"
      dominant-baseline="central"
      class="fill-ink-muted"
      font-size="13"
    >No positive values</text>
  {:else}
    {#each model.marks as mark (mark.id)}
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
      >
        <rect
          x={mark.box.x}
          y={mark.box.y}
          width={mark.box.width}
          height={mark.box.height}
          fill={mark.color}
          opacity={hoveredCategoryId !== undefined && hoveredCategoryId !== mark.categoryId
            ? mark.opacity * 0.2
            : mark.opacity}
          class={chosen ? "stroke-active-border" : "stroke-surface-panel"}
          stroke-width={chosen ? 3 : 2}
        >
          <title>{mark.categoryLabel} · {formatChartValue(mark.value, chart.valueFormat)}</title>
        </rect>
        {#if label !== undefined && mark.box.width > 54 && mark.box.height > 24}
          <text
            x={mark.box.x + 8}
            y={mark.box.y + 18}
            class="fill-ink-on-fill"
            font-size="12"
            font-weight="600"
            pointer-events="none"
          >{label}</text>
        {/if}
      </g>
    {/each}
  {/if}

  <PlotTextElements
    chartId={chart.id}
    elements={textElements}
    {selection}
    {width}
    {height}
  />
</svg>

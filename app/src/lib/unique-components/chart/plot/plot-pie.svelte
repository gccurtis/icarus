<script lang="ts">
  import type { PieChartModel } from "$json-store/types/data/chart";
  import { formatChartValue } from "$lib/unique-components/chart/chart-model";
  import type { ChartSelection, ChartSelectionTarget } from "$lib/unique-components/chart/chart-selection.svelte";
  import { layoutPie } from "$lib/unique-components/chart/plot/layout";

  let {
    chart,
    selection,
    width = 1000,
    height = 300,
    hoveredCategoryId = $bindable(undefined),
    ref = $bindable(null)
  }: {
    chart: PieChartModel;
    selection: ChartSelection;
    width?: number;
    height?: number;
    hoveredCategoryId?: string | undefined;
    ref?: SVGSVGElement | null;
  } = $props();

  const model = $derived(layoutPie(chart, { width, height }));
  const format = (value: number) => formatChartValue(value, chart.valueFormat);
  const PULL = 10;
  const additive = (event: MouseEvent | KeyboardEvent) =>
    event.shiftKey || event.metaKey || event.ctrlKey;
  const elementTarget = (elementId: string): ChartSelectionTarget => ({
    kind: "element",
    chartId: chart.id,
    elementId
  });
  const labelFor = (mark: (typeof model.marks)[number]) => {
    switch (chart.labels) {
      case "none":
        return undefined;
      case "value":
        return format(mark.value);
      case "category":
        return mark.categoryLabel;
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
  aria-label={chart.title === undefined ? "Pie chart" : `Pie chart: ${chart.title}`}
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
  {#each model.slices as slice, index (slice.markId)}
    {@const mark = model.marks[index]}
    {@const chosen = selection.hasDatum(chart.id, mark.datumId)}
    {@const label = labelFor(mark)}
    <g
      role="button"
      tabindex="0"
      aria-label={`${mark.categoryLabel}, ${format(mark.value)}, ${Math.round((mark.value / (model.total || 1)) * 100)} percent`}
      aria-pressed={chosen}
      transform={chosen
        ? `translate(${Math.cos(slice.mid) * PULL} ${Math.sin(slice.mid) * PULL})`
        : undefined}
      opacity={hoveredCategoryId !== undefined && hoveredCategoryId !== mark.categoryId
        ? mark.opacity * 0.25
        : mark.opacity}
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
      class="cursor-pointer outline-none transition-opacity"
    >
      <path d={slice.path} fill={mark.color} class="stroke-surface-panel" stroke-width="2">
        <title>{mark.categoryLabel} · {format(mark.value)}</title>
      </path>
      {#if chosen}
        <path d={slice.path} fill="none" class="stroke-active-border" stroke-width="3" pointer-events="none" />
      {/if}
      {#if label !== undefined && mark.value / (model.total || 1) > 0.06}
        <text
          x={mark.box.x}
          y={mark.box.y}
          text-anchor="middle"
          dominant-baseline="central"
          class="fill-ink-on-fill"
          font-size="13"
          pointer-events="none"
        >{label}</text>
      {/if}
    </g>
  {/each}
  {/if}

  {#each chart.elements as element (element.id)}
    {@const target = elementTarget(element.id)}
    {@const chosen = selection.has(target)}
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
        selection.click(target, additive(event));
      }}
      onkeydown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selection.click(target, additive(event));
      }}
    >{element.text}</text>
  {/each}
</svg>

<script lang="ts">
  import type { ChartSelection } from "$lib/unique-components/chart/chart-selection.svelte";
  import type { SeriesSpec } from "$lib/unique-components/chart/chart-spec";
  import {
    layoutBars,
    placeTotalLabels,
    placeValueLabels,
    type BarLayout
  } from "$lib/unique-components/chart/plot/layout";

  /**
   * Bars, drawn by us.
   *
   * **Every mark is a thing you can point at.** That is the difference this
   * component exists to make. A click selects one; shift or meta adds to the
   * selection; clicking a category label takes the whole column; clicking a
   * legend entry takes the whole series; clicking the background clears. A
   * selected mark carries a ring drawn *outside* its own edge, so selecting
   * something never changes its size or its colour — the two things that would
   * make a selected bar unreadable as data.
   *
   * **The geometry is `layout.ts` and nothing here.** This file positions
   * nothing; it draws what it is handed. That split is why the labels can be
   * checked by reading the maths rather than by measuring the screen — and three
   * numbers landing on top of each other is a defect only measuring ever catches.
   */
  let {
    data,
    x,
    series,
    layout = "stack",
    horizontal = false,
    labels = "none",
    height = 300,
    format = (value: number) => value.toLocaleString(),
    selection,
    hovered = $bindable(undefined),
    ref = $bindable(null)
  }: {
    data: readonly Record<string, unknown>[];
    x: string;
    series: readonly SeriesSpec[];
    layout?: BarLayout;
    horizontal?: boolean;
    labels?: "none" | "value" | "total";
    height?: number;
    format?: (value: number) => string;
    selection: ChartSelection;
    hovered?: string | undefined;
    ref?: SVGSVGElement | null;
  } = $props();

  /* A fixed internal coordinate space, as the Marimekko uses: it scales to any
     container without a resize observer and serializes at any size. */
  const W = 1000;
  const PAD = { top: 22, right: 16, bottom: 34, left: 56 };

  const size = $derived({ width: W, height, pad: PAD });
  const model = $derived(layoutBars(data, x, series, layout, horizontal, size));

  const valueLabels = $derived(
    labels === "value" ? placeValueLabels(model.marks, layout, horizontal, format) : []
  );
  const totalLabels = $derived(
    labels === "total" ? placeTotalLabels(model.marks, model.bands, horizontal, format) : []
  );

  const tickText = (value: number) =>
    layout === "expand" ? `${Math.round(value * 100)}%` : format(value);

  const dim = (key: string) => hovered !== undefined && hovered !== key;
</script>

<!--
  The listener is on the svg because clearing the selection is what clicking the
  *background* means, and the background is the svg itself — there is no inner
  element that is "the empty part of the chart". The rule below wants a widget;
  the widgets here are the marks inside, each of which is one.
-->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg
  bind:this={ref}
  viewBox="0 0 {W} {height}"
  width="100%"
  {height}
  role="img"
  aria-label="Bar chart"
  onclick={(event) => {
    // A click that reached the background and not a mark clears the selection.
    if (event.target === event.currentTarget) selection.clear();
  }}
  onkeydown={(event) => {
    if (event.key === "Escape") selection.clear();
  }}
  tabindex="-1"
  class="overflow-visible"
>
  <!-- Gridlines first, so every mark sits over them. -->
  {#each model.ticks as tick (tick.value)}
    {#if horizontal}
      <line
        x1={tick.at}
        y1={model.plot.y}
        x2={tick.at}
        y2={model.plot.y + model.plot.height}
        class="stroke-border-subtle"
        stroke-width="1"
      />
      <text x={tick.at} y={height - PAD.bottom + 16} text-anchor="middle" class="fill-ink-muted" font-size="12">
        {tickText(tick.value)}
      </text>
    {:else}
      <line
        x1={model.plot.x}
        y1={tick.at}
        x2={model.plot.x + model.plot.width}
        y2={tick.at}
        class="stroke-border-subtle"
        stroke-width="1"
      />
      <text x={PAD.left - 8} y={tick.at + 4} text-anchor="end" class="fill-ink-muted" font-size="12">
        {tickText(tick.value)}
      </text>
    {/if}
  {/each}

  {#each model.marks as mark (mark.id)}
    {@const chosen = selection.has(mark.id)}
    <g
      role="button"
      tabindex="0"
      aria-label={`${mark.category}, ${mark.seriesKey}, ${format(mark.value)}`}
      aria-pressed={chosen}
      onpointerenter={() => (hovered = mark.seriesKey)}
      onpointerleave={() => (hovered = undefined)}
      onclick={(event) => {
        event.stopPropagation();
        selection.click(mark.id, event.shiftKey || event.metaKey || event.ctrlKey);
      }}
      onkeydown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selection.click(mark.id, event.shiftKey);
      }}
      class="cursor-pointer outline-none"
    >
      <rect
        x={mark.box.x}
        y={mark.box.y}
        width={Math.max(0, mark.box.width)}
        height={Math.max(0, mark.box.height)}
        fill={mark.color}
        opacity={dim(mark.seriesKey) ? 0.2 : 1}
        class="stroke-surface-panel"
        stroke-width="1"
      >
        <title>{mark.category} · {mark.seriesKey} · {format(mark.value)}</title>
      </rect>

      <!--
        The selection ring sits outside the mark's own edge and paints nothing
        inside it. Changing a selected bar's fill would change what the chart
        says; changing its size would move everything beside it.
      -->
      {#if chosen}
        <rect
          x={mark.box.x - 2}
          y={mark.box.y - 2}
          width={Math.max(0, mark.box.width + 4)}
          height={Math.max(0, mark.box.height + 4)}
          fill="none"
          class="stroke-ink-primary"
          stroke-width="2"
          rx="2"
          pointer-events="none"
        />
      {/if}
    </g>
  {/each}

  <!-- Labels last, so nothing is drawn over a figure. -->
  {#each valueLabels as label (label.markId)}
    <text
      x={label.x}
      y={label.y}
      text-anchor={horizontal && !label.inside ? "start" : "middle"}
      dominant-baseline={label.inside || horizontal ? "central" : "auto"}
      class={label.inside ? "fill-ink-on-fill" : "fill-ink-secondary"}
      font-size="12"
      pointer-events="none"
    >
      {label.text}
    </text>
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
    >
      {label.text}
    </text>
  {/each}

  <!-- Category labels are click targets: they select the whole column. -->
  {#each model.bands as band (band.category)}
    <text
      x={horizontal ? PAD.left - 8 : band.box.x + band.box.width / 2}
      y={horizontal ? band.box.y + band.box.height / 2 + 4 : height - PAD.bottom + 16}
      text-anchor={horizontal ? "end" : "middle"}
      role="button"
      tabindex="0"
      onclick={(event) => {
        event.stopPropagation();
        selection.category(band.category, series, event.shiftKey || event.metaKey);
      }}
      onkeydown={(event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        selection.category(band.category, series, event.shiftKey);
      }}
      class="fill-ink-secondary cursor-pointer"
      font-size="12"
    >
      {band.category}
    </text>
  {/each}
</svg>

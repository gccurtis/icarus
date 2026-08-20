<script lang="ts">
  import { AreaChart, BarChart, Bars, Labels, LineChart, PieChart, ScatterChart, Spline } from "layerchart";

  import { seriesColor } from "$lib/unique-components/chart/palette";

  /**
   * A chart, of whichever kind is asked for.
   *
   * **One component rather than six, because the kind is a value.** Changing a
   * bar chart into a line chart is something the reader does, not something the
   * author decides once — the same numbers seen a different way — so the kind is
   * a prop rather than a different import.
   *
   * `layerchart` underneath: MIT, Svelte 5 native, SVG rather than canvas. SVG
   * is the load-bearing half of that choice. It means the chart is painted by
   * the same custom properties as everything else, so it follows a theme instead
   * of carrying a palette; and it means the chart serializes, which is the whole
   * basis of taking a picture of it.
   *
   * **Orientation swaps which axis the categories are on, not just the drawing.**
   * A horizontal bar chart puts the category on `y` and the values on `x`, and
   * passing the category as `x` regardless is how it silently stopped stacking
   * and grouping. The library is explicit about this — `valueAxis` is derived
   * from `orientation` — and the axis assignment below is the fix.
   *
   * **Labels are drawn by us, not by the library.** `BarChart` renders its bars
   * from an internal snippet with no room for anything beside them, so the
   * `marks` snippet is taken over: the bars are rendered as the library would,
   * and `Labels` is added alongside. That is the price of figures on bars, and
   * figures on bars are not decoration — a chart read next to its own table is
   * being used to compare values, and making people estimate from height is the
   * thing the table was supposed to stop.
   */
  type Kind = "bar" | "line" | "area" | "pie" | "scatter" | "mixed";

  let {
    kind = "bar",
    data,
    x,
    series,
    layout = "overlap",
    orientation = "vertical",
    labels = "none",
    lineSeries,
    height = 260,
    legend = true,
    format = (value: number) => value.toLocaleString(),
    ref = $bindable(null),
    hovered = $bindable(undefined)
  }: {
    kind?: Kind;
    data: readonly Record<string, unknown>[];
    /** The field naming each category, whichever axis it ends up on. */
    x: string;
    /** One entry per line, band or slice. Colour is assigned unless given. */
    series: readonly { key: string; label?: string; color?: string }[];
    /**
     * How several series share the space. `group` is clustered, `stack` is
     * stacked, `stackExpand` is stacked to 100%. Ignored where it cannot apply.
     */
    layout?: "overlap" | "group" | "stack" | "stackExpand";
    /** Which axis the categories are on. Horizontal puts them down the side. */
    orientation?: "vertical" | "horizontal";
    /**
     * Figures on the bars.
     *
     * `value` puts each series' own number on its band — inside when the band is
     * deep enough to hold it, outside when it is not, which is what `smart`
     * placement decides. `total` is for a stack: the sum sits above the column,
     * because the one number a stacked bar cannot show is the one most people
     * are reading it for.
     */
    labels?: "none" | "value" | "total";
    /**
     * For `mixed`: the series drawn as a line over the bars.
     *
     * A mixed chart exists for one situation — a quantity and a rate that share
     * a category but not a unit, like minutes lost and percentage restored. The
     * line series is named rather than inferred, because which of them is the
     * rate is a judgment no component can make.
     */
    lineSeries?: string;
    height?: number;
    legend?: boolean;
    /** How a figure is written. Defaults to grouped digits. */
    format?: (value: number) => string;
    /** The rendered `svg`, for `copyChart`. */
    ref?: SVGSVGElement | null;
    /** Which series the pointer is over. Bindable, so a table can share it. */
    hovered?: string | undefined;
  } = $props();

  const resolved = $derived(
    series.map((entry, index) => ({
      key: entry.key,
      label: entry.label ?? entry.key,
      value: entry.key,
      color: entry.color ?? seriesColor(index)
    }))
  );

  const bars = $derived(
    kind === "mixed" ? resolved.filter((entry) => entry.key !== lineSeries) : resolved
  );
  const line = $derived(resolved.find((entry) => entry.key === lineSeries));

  /** One entry per slice, carrying only the colour the library reads off it. */
  const sliceColors = $derived(
    data.map((row, index) => ({
      key: String(row[x] ?? index),
      color: seriesColor(index)
    }))
  );

  const horizontal = $derived(orientation === "horizontal");

  /** The category goes on whichever axis is not the value axis. */
  const axes = $derived(horizontal ? { y: x } : { x });

  /**
   * The stack's height for one row, read off the row itself rather than by
   * index — the label accessor is handed the datum, and matching by position
   * would break the moment the chart sorted or filtered anything.
   */
  const sumOf = (row: Record<string, unknown>) =>
    series.reduce((sum, entry) => sum + (Number(row[entry.key]) || 0), 0);

  /**
   * Which series the pointer is over, if any.
   *
   * The library dims by series when its legend is hovered, and the same gesture
   * on the bars themselves is the one people actually try first — a legend is
   * where you go once you have already failed to get an answer from the picture.
   * The two share one rule below so they cannot disagree.
   *
   * Bindable, so a caller can hold the same hover: the data table beside this
   * chart highlights its column from it, which makes the number and the band it
   * came from findable in one movement.
   */

  const dimmed = (key: string, context: { series: { isHighlighted: (key: string, on: boolean) => boolean } }) => {
    if (hovered !== undefined) return hovered === key ? 1 : 0.15;
    return context.series.isHighlighted(key, true) ? 1 : 0.1;
  };

  let host = $state<HTMLDivElement | null>(null);

  // The svg belongs to the library, so it is found rather than bound. Re-run on
  // every kind change: switching chart type replaces the element entirely.
  $effect(() => {
    void kind;
    void data;
    void orientation;
    ref = host?.querySelector("svg") ?? null;
  });
</script>

{#snippet barMarks({ context }: { context: any })}
  <!--
    The library's own bars, reproduced so that something can be drawn beside
    them and so that hovering one can dim the rest. Every prop here is what
    `BarChart` sets itself; the additions are the hover group and the labels.
  -->
  {#each context.series.visibleSeries as entry, index (entry.key)}
    <!--
      A group around each series rather than handlers on `Bars`: the group is
      one hit area for the whole series, so moving between two bars of the same
      colour does not flicker the highlight off and on.
    -->
    <g
      role="presentation"
      onpointerenter={() => (hovered = entry.key)}
      onpointerleave={() => (hovered = undefined)}
    >
      <Bars
        seriesKey={entry.key}
        x1={!horizontal && layout === "group" ? () => entry.value ?? entry.key : undefined}
        y1={horizontal && layout === "group" ? () => entry.value ?? entry.key : undefined}
        rounded={context.series.isStacked && index !== context.series.visibleSeries.length - 1
          ? "none"
          : "edge"}
        radius={4}
        strokeWidth={1}
        opacity={dimmed(entry.key, context)}
      />
    </g>
  {/each}

  {#if labels === "value"}
    {#each context.series.visibleSeries as entry (entry.key)}
      <!--
        The value accessor is explicit, and it has to be. Left to itself the
        label reads the *stacked* position, so a three-part stack of 1180/460/202
        was labelled 1,180 / 1,640 / 1,842 — running totals presented as the
        values they are not. `value` here is the series' own number.
      -->
      <Labels
        seriesKey={entry.key}
        value={(row: Record<string, unknown>) => Number(row[entry.key]) || 0}
        placement={layout === "stack" || layout === "stackExpand" ? "center" : "smart"}
        format={(value: number) => format(value)}
        class="text-caption"
      />
    {/each}
  {:else if labels === "total"}
    <!--
      One label per category rather than per series. The sum of a stack is the
      figure a stacked bar physically cannot show, so it is placed outside the
      last band rather than inside any of them.
    -->
    <Labels
      seriesKey={context.series.visibleSeries.at(-1)?.key}
      placement="outside"
      offset={6}
      value={(row: Record<string, unknown>) => sumOf(row)}
      format={(value: number) => format(value)}
      class="text-caption"
    />
  {/if}

  {#if kind === "mixed" && line}
    <Spline seriesKey={line.key} y={line.key} stroke={line.color} width={2} />
  {/if}
{/snippet}

<div bind:this={host} class="text-ink-muted w-full" style="height: {height}px">
  {#if kind === "bar" || kind === "mixed"}
    <BarChart
      {data}
      {...axes}
      series={bars}
      {orientation}
      seriesLayout={layout}
      {legend}
      marks={barMarks}
    />
  {:else if kind === "line"}
    <LineChart {data} {...axes} series={resolved} {legend} />
  {:else if kind === "area"}
    <AreaChart
      {data}
      {...axes}
      series={resolved}
      seriesLayout={layout === "group" ? "overlap" : layout}
      {legend}
    />
  {:else if kind === "scatter"}
    <ScatterChart {data} {...axes} series={resolved} {legend} />
  {:else}
    <!--
      A pie's slices are categories, not series, so the palette has to be handed
      over per slice. Left alone the library falls back to `--color-info` and
      `--color-warning`, which this project's token bridge does not define — so
      it dropped through to its own literal scheme and the pie was the one chart
      that ignored the theme entirely.
    -->
    <PieChart
      data={data as never}
      key={x}
      value={resolved[0]?.key}
      series={sliceColors as never}
      {legend}
    />
  {/if}
</div>

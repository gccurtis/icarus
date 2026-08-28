<script lang="ts">
  import { traceNode } from "$development-components/trace.svelte";

  import { seriesColor } from "$authored-components/chart/palette";

  /**
   * A Marimekko: columns whose *width* is a quantity too.
   *
   * Not `layerchart`'s, because no general library has it — width-varying
   * stacked columns are not a variant of a bar chart, they are a different
   * geometry. It is drawn here in plain SVG for the
   * same reason the others are SVG: it styles from tokens and it serializes, so
   * `copyChart` works on it exactly as it does on the rest.
   *
   * **It is the chart for share-of-share**, which is a question the bar chart
   * cannot ask: how much of the whole does each group account for, *and* how is
   * each group divided. A stacked bar chart shows the second and lies about the
   * first by giving a group with 2% of the total the same width as one with 40%.
   *
   * **Every segment carries its own figure or none do.** Reading area is
   * something people are famously bad at, so a Mekko that omits the numbers is
   * asking to be misread; the label is dropped only where the segment is too
   * small to hold it, and then the tooltip is the answer.
   */
  let {
    data,
    x,
    weight,
    series,
    height = 280,
    ref = $bindable(null)
  }: {
    data: readonly Record<string, number | string>[];
    /** The field naming each column. */
    x: string;
    /** The field deciding each column's width — the quantity being divided. */
    weight: string;
    /** The stack, bottom first. */
    series: readonly { key: string; label?: string; color?: string }[];
    height?: number;
    ref?: SVGSVGElement | null;
  } = $props();

  const trace = traceNode("ChartMekko", () => ({ x, weight, series, height }));

  /* A viewBox rather than measured pixels: the chart scales to its container
     without a resize observer, and serializes at any size. */
  const W = 1000;
  const PAD = { top: 8, right: 8, bottom: 34, left: 8 };
  const GAP = 4;

  const plot = $derived({ w: W - PAD.left - PAD.right, h: height - PAD.top - PAD.bottom });

  const columns = $derived.by(() => {
    const weights = data.map((row) => Number(row[weight]) || 0);
    const total = weights.reduce((sum, value) => sum + value, 0) || 1;
    const usable = plot.w - GAP * Math.max(0, data.length - 1);

    let cursor = PAD.left;
    return data.map((row, index) => {
      const width = (weights[index] / total) * usable;
      const left = cursor;
      cursor += width + GAP;

      const values = series.map((entry) => Number(row[entry.key]) || 0);
      const stackTotal = values.reduce((sum, value) => sum + value, 0) || 1;

      let y = PAD.top;
      const segments = series.map((entry, sIndex) => {
        const share = values[sIndex] / stackTotal;
        const segmentHeight = share * plot.h;
        const top = y;
        y += segmentHeight;
        return {
          key: entry.key,
          label: entry.label ?? entry.key,
          color: entry.color ?? seriesColor(sIndex),
          share,
          value: values[sIndex],
          top,
          height: segmentHeight
        };
      });

      return {
        name: String(row[x]),
        share: weights[index] / total,
        left,
        width,
        segments
      };
    });
  });

  const percent = (share: number) => `${Math.round(share * 100)}%`;
</script>

<svg
  {...trace}
  bind:this={ref}
  viewBox="0 0 {W} {height}"
  width="100%"
  {height}
  role="img"
  aria-label="Marimekko chart"
  class="overflow-visible"
>
  {#each columns as column (column.name)}
    {#each column.segments as segment (segment.key)}
      <rect
        x={column.left}
        y={segment.top}
        width={Math.max(0, column.width)}
        height={Math.max(0, segment.height)}
        fill={segment.color}
        class="stroke-surface-panel"
        stroke-width="1"
      >
        <title>{column.name} · {segment.label} · {percent(segment.share)}</title>
      </rect>

      <!-- Dropped rather than shrunk: a figure that does not fit its segment
           is a figure sitting on the segment above it. -->
      {#if segment.height > 22 && column.width > 46}
        <text
          x={column.left + column.width / 2}
          y={segment.top + segment.height / 2}
          text-anchor="middle"
          dominant-baseline="central"
          class="fill-ink-on-fill text-caption"
          font-size="13"
        >
          {percent(segment.share)}
        </text>
      {/if}
    {/each}

    <text
      x={column.left + column.width / 2}
      y={height - PAD.bottom + 16}
      text-anchor="middle"
      class="fill-ink-secondary"
      font-size="13"
    >
      {column.name}
    </text>
    <text
      x={column.left + column.width / 2}
      y={height - PAD.bottom + 30}
      text-anchor="middle"
      class="fill-ink-muted"
      font-size="11"
    >
      {percent(column.share)}
    </text>
  {/each}
</svg>

<script lang="ts">
  import type { ChartSelection } from "$lib/unique-components/chart/chart-selection.svelte";
  import { layoutPie } from "$lib/unique-components/chart/plot/layout";

  /**
   * A pie, drawn by us.
   *
   * **It has no axes, and that is not a detail.** The version this replaces put
   * a pie inside a chart frame and drew a value axis and gridlines behind it — a
   * pie has no axes to have, and the frame was there because the frame belonged
   * to the library rather than to the chart. Drawing our own means a pie is a
   * circle and nothing else.
   *
   * **A selected slice pulls out.** That is the convention every presentation
   * tool uses, and it is better here than a ring: a ring around a wedge is hard
   * to see against its neighbours, and pulling it out reads at a glance and
   * survives being copied into a slide as an image.
   *
   * Shift or meta adds to the selection, exactly as the bars do — the two must
   * not have different rules, because the same panel inspects the result of
   * both.
   */
  let {
    data,
    x,
    value,
    height = 300,
    format = (n: number) => n.toLocaleString(),
    selection,
    ref = $bindable(null)
  }: {
    data: readonly Record<string, unknown>[];
    /** The field naming each slice. */
    x: string;
    /** The field the slice sizes come from. */
    value: string;
    height?: number;
    format?: (value: number) => string;
    selection: ChartSelection;
    ref?: SVGSVGElement | null;
  } = $props();

  const W = 1000;
  const model = $derived(layoutPie(data, x, value, { width: W, height }));
  const total = $derived(model.marks.reduce((sum, mark) => sum + mark.value, 0) || 1);

  /** How far a selected slice steps away from the middle. */
  const PULL = 10;
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg
  bind:this={ref}
  viewBox="0 0 {W} {height}"
  width="100%"
  {height}
  role="img"
  aria-label="Pie chart"
  onclick={(event) => {
    if (event.target === event.currentTarget) selection.clear();
  }}
  onkeydown={(event) => {
    if (event.key === "Escape") selection.clear();
  }}
  tabindex="-1"
  class="overflow-visible"
>
  {#each model.slices as slice, index (slice.markId)}
    {@const mark = model.marks[index]}
    {@const chosen = selection.has(slice.markId)}
    <g
      role="button"
      tabindex="0"
      aria-label={`${mark.category}, ${format(mark.value)}, ${Math.round((mark.value / total) * 100)} percent`}
      aria-pressed={chosen}
      transform={chosen
        ? `translate(${Math.cos(slice.mid) * PULL} ${Math.sin(slice.mid) * PULL})`
        : undefined}
      onclick={(event) => {
        event.stopPropagation();
        selection.click(slice.markId, event.shiftKey || event.metaKey || event.ctrlKey);
      }}
      onkeydown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selection.click(slice.markId, event.shiftKey);
      }}
      class="cursor-pointer outline-none transition-transform"
    >
      <path
        d={slice.path}
        fill={mark.color}
        class="stroke-surface-panel"
        stroke-width="2"
      >
        <title>{mark.category} · {format(mark.value)}</title>
      </path>

      <!--
        The outline goes on the wedge itself rather than around it. A ring drawn
        outside an arc would cross its neighbours; the step outward is what
        actually reads.
      -->
      {#if chosen}
        <path d={slice.path} fill="none" class="stroke-ink-primary" stroke-width="2" pointer-events="none" />
      {/if}

      <!-- A share only where the wedge can hold one. -->
      {#if mark.value / total > 0.06}
        <text
          x={mark.box.x}
          y={mark.box.y}
          text-anchor="middle"
          dominant-baseline="central"
          class="fill-ink-on-fill"
          font-size="13"
          pointer-events="none"
        >
          {Math.round((mark.value / total) * 100)}%
        </text>
      {/if}
    </g>
  {/each}
</svg>

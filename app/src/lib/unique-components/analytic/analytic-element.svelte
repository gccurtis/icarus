<script lang="ts">
  import GripVertical from "@lucide/svelte/icons/grip-vertical";
  import Maximize2 from "@lucide/svelte/icons/maximize-2";

  import type {
    AnalyticModel,
    AnalyticTableSelectionTarget
  } from "$json-store/types/data/analytic";
  import type { ChartFrame } from "$json-store/types/data/chart";
  import AnalyticComponent from "$lib/unique-components/analytic/analytic-component.svelte";
  import {
    createChartSelection,
    type ChartSelection
  } from "$lib/unique-components/chart/chart-selection.svelte";
  import {
    moveChartFrame,
    resizeChartFrame,
    type ChartBounds,
    type ChartMinimum
  } from "$lib/unique-components/chart/frame";

  const localSelection = createChartSelection();

  let {
    analytic,
    frame = $bindable(),
    chartSelection = localSelection,
    tableSelection,
    selected = $bindable(false),
    bounds,
    minimum,
    scale = 1,
    onframechange,
    onselect,
    ontableselect
  }: {
    analytic: AnalyticModel;
    frame: ChartFrame;
    chartSelection?: ChartSelection;
    tableSelection?: AnalyticTableSelectionTarget;
    selected?: boolean;
    bounds?: ChartBounds;
    minimum?: ChartMinimum;
    scale?: number;
    onframechange?: (frame: ChartFrame) => void;
    onselect?: (analyticId: string) => void;
    ontableselect?: (target: AnalyticTableSelectionTarget) => void;
  } = $props();

  const commit = (next: ChartFrame) => {
    frame = next;
    onframechange?.(next);
  };

  const choose = () => {
    selected = true;
    onselect?.(analytic.id);
  };

  const begin = (event: PointerEvent, mode: "move" | "resize") => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    choose();
    const handle = event.currentTarget as HTMLElement;
    const start = { x: event.clientX, y: event.clientY, frame: { ...frame } };
    handle.setPointerCapture(event.pointerId);
    const update = (next: PointerEvent) => {
      const dx = (next.clientX - start.x) / Math.max(0.01, scale);
      const dy = (next.clientY - start.y) / Math.max(0.01, scale);
      commit(
        mode === "move"
          ? moveChartFrame(start.frame, dx, dy, bounds)
          : resizeChartFrame(start.frame, dx, dy, bounds, minimum)
      );
    };
    const finish = () => {
      handle.removeEventListener("pointermove", update);
      handle.removeEventListener("pointerup", finish);
      handle.removeEventListener("pointercancel", finish);
    };
    handle.addEventListener("pointermove", update);
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  };

  const nudge = (event: KeyboardEvent, mode: "move" | "resize") => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    choose();
    const step = event.shiftKey ? 10 : 1;
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    commit(
      mode === "move"
        ? moveChartFrame(frame, dx, dy, bounds)
        : resizeChartFrame(frame, dx, dy, bounds, minimum)
    );
  };
</script>

<div
  class="analytic-element bg-surface-panel rounded-panel border shadow-sm"
  class:selected
  style:left={`${frame.x}px`}
  style:top={`${frame.y}px`}
  style:width={`${frame.width}px`}
  style:height={`${frame.height}px`}
  role="group"
  aria-label={analytic.title}
  onpointerdown={choose}
>
  <button
    type="button"
    class="analytic-handle text-caption text-ink-secondary hover:bg-surface-panel-hover cursor-move"
    aria-label={`Move ${analytic.title}`}
    title="Drag to move · Arrow keys to nudge · Shift for 10 px"
    onpointerdown={(event) => begin(event, "move")}
    onkeydown={(event) => nudge(event, "move")}
  >
    <GripVertical size={14} aria-hidden="true" />
    <span class="truncate">{analytic.title}</span>
  </button>

  <div class="analytic-content">
    <AnalyticComponent
      {analytic}
      {chartSelection}
      {tableSelection}
      {ontableselect}
      height={Math.max(1, frame.height - 28)}
      showTitle={false}
    />
  </div>

  <button
    type="button"
    class="analytic-resize bg-surface-panel text-ink-muted hover:text-ink-primary"
    aria-label={`Resize ${analytic.title}`}
    title="Drag to resize · Arrow keys to resize · Shift for 10 px"
    onpointerdown={(event) => begin(event, "resize")}
    onkeydown={(event) => nudge(event, "resize")}
  >
    <Maximize2 size={13} aria-hidden="true" />
  </button>
</div>

<style>
  .analytic-element {
    position: absolute;
    display: grid;
    min-width: 0;
    min-height: 0;
    grid-template-rows: 1.75rem minmax(0, 1fr);
    overflow: hidden;
    border-color: var(--token-border-subtle);
    touch-action: none;
  }

  .analytic-element.selected {
    border-color: var(--token-color-active-border);
    outline: 1px solid var(--token-color-active-border);
  }

  .analytic-handle {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1);
    padding-inline: calc(var(--token-spacing-unit) * 1.5);
    text-align: start;
    border-bottom: 1px solid var(--token-border-subtle);
    touch-action: none;
  }

  .analytic-content {
    min-width: 0;
    min-height: 0;
  }

  .analytic-resize {
    position: absolute;
    right: 0;
    bottom: 0;
    display: grid;
    width: 1.5rem;
    height: 1.5rem;
    cursor: nwse-resize;
    place-items: center;
    border-top: 1px solid var(--token-border-subtle);
    border-left: 1px solid var(--token-border-subtle);
    touch-action: none;
  }
</style>

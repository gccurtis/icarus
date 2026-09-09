<script lang="ts">
  import {
    HEADER,
    MARKER,
    type Edge,
    type RowEdge
  } from "$authored-components/sheet-surface/sheet-surface-geometry";
  import type { SurfaceScene } from "$authored-components/sheet-surface/sheet-surface-types";

  let {
    scene,
    columns,
    rows,
    scale,
    columnSize,
    rowSize,
    ondrag,
    onpreview,
    onresize,
    onrowresize
  }: {
    scene: SurfaceScene;
    columns: readonly Edge[];
    rows: readonly RowEdge[];
    scale: number;
    /** The drawn width of a column right now, drafts included. */
    columnSize: (index: number) => number;
    /** The drawn height of a row right now, drafts included. */
    rowSize: (index: number) => number;
    /** A drag started or finished; the grid stops taking pointer events while one runs. */
    ondrag?: (running: boolean) => void;
    /** A size to draw while the pointer is down, or undefined to drop the draft. */
    onpreview?: (kind: "column" | "row", index: number, size: number | undefined) => void;
    onresize?: (column: number, size: number) => void;
    onrowresize?: (row: number, size: number) => void;
  } = $props();

  const drag = (
    kind: "column" | "row",
    index: number,
    floor: number,
    commit: (size: number) => void
  ) => (event: PointerEvent) => {
    const along = kind === "column";
    const from = along ? event.clientX : event.clientY;
    const start = along ? columnSize(index) : rowSize(index);
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    ondrag?.(true);
    let size = start;

    const move = (moved: PointerEvent) => {
      size = Math.max(floor, Math.round(start + (along ? moved.clientX : moved.clientY) - from));
      onpreview?.(kind, index, size);
    };
    const done = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", done);
      onpreview?.(kind, index, undefined);
      ondrag?.(false);
      commit(Math.round(size / scale));
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", done);
  };
</script>

{#each columns as edge (edge.index)}
  <div
    class="handle across"
    role="separator"
    aria-orientation="vertical"
    aria-label={`Width of column ${scene.columns[edge.index]?.label ?? ""}`}
    tabindex="-1"
    style={`left: ${edge.x - 3}px; height: ${Math.round(HEADER * scale)}px;`}
    onpointerdown={drag("column", edge.index, 28, (size) => onresize?.(edge.index, size))}
  ></div>
{/each}
{#each rows as edge (edge.index)}
  <div
    class="handle down"
    role="separator"
    aria-orientation="horizontal"
    aria-label={`Height of row ${edge.index + 1}`}
    tabindex="-1"
    style={`top: ${edge.y - 3}px; width: ${Math.round(MARKER * scale)}px;`}
    onpointerdown={drag("row", edge.index, 16, (size) => onrowresize?.(edge.index, size))}
  ></div>
{/each}

<style>
  .handle {
    position: absolute;
    pointer-events: auto;
    touch-action: none;
  }

  .handle.across {
    top: 0;
    width: 7px;
    cursor: col-resize;
  }

  .handle.down {
    left: 0;
    height: 7px;
    cursor: row-resize;
  }
</style>

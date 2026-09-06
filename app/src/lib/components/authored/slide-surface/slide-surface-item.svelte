<script lang="ts">
  import SlideSurfaceText from "$authored-components/slide-surface/slide-surface-text.svelte";
  import type {
    SurfaceFrame,
    SurfaceItem,
    SurfaceTextEdit
  } from "$authored-components/slide-surface/slide-surface-types";

  let {
    item,
    frame,
    rotation,
    units,
    scale = 1,
    editing,
    cells = [],
    busy = false,
    onedit,
    oncaret,
    onexit,
    ongrow
  }: {
    item: SurfaceItem;
    frame: SurfaceFrame;
    rotation: number;
    units: { readonly width: number; readonly height: number };
    scale?: number;
    editing?: string;
    cells?: readonly string[];
    busy?: boolean;
    onedit?: (edit: SurfaceTextEdit) => void;
    oncaret?: (blockId: string, from: number, to: number) => void;
    onexit?: () => void;
    ongrow?: (id: string, height: number) => void;
  } = $props();

  const box = $derived({
    x: frame.x * units.width,
    y: frame.y * units.height,
    width: Math.max(1, frame.width * units.width),
    height: Math.max(1, frame.height * units.height)
  });

  const placement = $derived(
    `left: ${box.x}px; top: ${box.y}px; width: ${box.width}px; height: ${box.height}px; ` +
      `rotate: ${rotation}deg; opacity: ${item.opacity}; ` +
      (item.shadow && item.type !== "shape" && item.type !== "line" ? `filter: drop-shadow(${item.shadow});` : "")
  );

  const dashArray = $derived(
    item.dash === "dashed" ? `${item.strokeWidth * 4} ${item.strokeWidth * 2.5}` : item.dash === "dotted" ? `${item.strokeWidth} ${item.strokeWidth * 2}` : undefined
  );

  const inset = $derived(item.strokeWidth / 2);

  const shapePath = $derived.by(() => {
    const w = box.width;
    const h = box.height;
    const i = inset;
    switch (item.shape) {
      case "triangle":
        return `M ${w / 2} ${i} L ${w - i} ${h - i} L ${i} ${h - i} Z`;
      case "diamond":
        return `M ${w / 2} ${i} L ${w - i} ${h / 2} L ${w / 2} ${h - i} L ${i} ${h / 2} Z`;
      case "arrow": {
        const head = Math.min(w * 0.35, h);
        const shaft = h * 0.3;
        return `M ${i} ${shaft} L ${w - head} ${shaft} L ${w - head} ${i} L ${w - i} ${h / 2} L ${w - head} ${h - i} L ${w - head} ${h - shaft} L ${i} ${h - shaft} Z`;
      }
      case "callout": {
        const tail = Math.min(h * 0.25, 40);
        const body = h - tail;
        return `M ${i} ${i} L ${w - i} ${i} L ${w - i} ${body} L ${w * 0.35} ${body} L ${w * 0.22} ${h - i} L ${w * 0.25} ${body} L ${i} ${body} Z`;
      }
      default:
        return undefined;
    }
  });

  const textInset = $derived.by(() => {
    const w = box.width;
    const h = box.height;
    const pad = item.text?.padding ?? 12;
    const half = pad / 2;
    switch (item.type === "shape" ? item.shape : undefined) {
      case "ellipse": {
        const dx = (w * (1 - Math.SQRT1_2)) / 2;
        const dy = (h * (1 - Math.SQRT1_2)) / 2;
        return `${dy + half}px ${dx + half}px ${dy + half}px ${dx + half}px`;
      }
      case "triangle":
        return `${h / 2}px ${w / 4 + half}px ${pad}px ${w / 4 + half}px`;
      case "diamond":
        return `${h / 4 + half}px ${w / 4 + half}px ${h / 4 + half}px ${w / 4 + half}px`;
      case "arrow": {
        const head = Math.min(w * 0.35, h);
        return `${h * 0.3 + half}px ${head + half}px ${h * 0.3 + half}px ${pad}px`;
      }
      case "callout": {
        const tail = Math.min(h * 0.25, 40);
        return `${pad}px ${pad}px ${tail + pad}px ${pad}px`;
      }
      default:
        return `${pad}px`;
    }
  });

  const lineBox = $derived.by(() => {
    if (!item.line) return undefined;
    const from = { x: item.line.from.x * units.width, y: item.line.from.y * units.height };
    const to = { x: item.line.to.x * units.width, y: item.line.to.y * units.height };
    const pad = Math.max(12, item.strokeWidth * 4);
    const left = Math.min(from.x, to.x) - pad;
    const top = Math.min(from.y, to.y) - pad;
    return {
      left,
      top,
      width: Math.abs(to.x - from.x) + pad * 2,
      height: Math.abs(to.y - from.y) + pad * 2,
      x1: from.x - left,
      y1: from.y - top,
      x2: to.x - left,
      y2: to.y - top
    };
  });

  const border = $derived(item.strokeWidth === 0 ? 0 : Math.max(item.strokeWidth, 1 / scale));
  const rule = $derived(item.stroke ?? "var(--token-border-strong)");

  const textFor = (blockId: string) => editing === blockId;

  let prose = $state<HTMLDivElement>();

  $effect(() => {
    const grow = ongrow;
    const host = prose;
    const height = box.height;
    void textInset;
    if (grow === undefined || busy || host === undefined) return;
    if (item.overflow !== "grow" || item.text === undefined || item.type === "table") return;
    const child = host.firstElementChild;
    if (!(child instanceof HTMLElement)) return;

    let pending: number | undefined;
    const watcher = new ResizeObserver(() => {
      const style = getComputedStyle(host);
      const needed = child.offsetHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      if (Math.abs(needed - height) <= 0.75) return;
      if (pending !== undefined) cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        pending = undefined;
        grow(item.id, needed);
      });
    });
    watcher.observe(child);
    return () => {
      watcher.disconnect();
      if (pending !== undefined) cancelAnimationFrame(pending);
    };
  });
</script>

{#if item.type === "line" && item.line && lineBox}
  <div
    class="item item-line"
    data-item={item.id}
    class:is-locked={item.locked}
    style="left: {lineBox.left}px; top: {lineBox.top}px; width: {lineBox.width}px; height: {lineBox.height}px; opacity: {item.opacity};"
  >
    <svg width={lineBox.width} height={lineBox.height} overflow="visible" aria-hidden="true">
      <defs>
        <marker id="end-{item.id}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth">
          {#if item.line.end === "arrow"}<path d="M0,0 L6,3 L0,6 Z" fill={item.stroke ?? "currentColor"} />{/if}
          {#if item.line.end === "dot"}<circle cx="3" cy="3" r="2.5" fill={item.stroke ?? "currentColor"} />{/if}
        </marker>
        <marker id="start-{item.id}" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse" markerUnits="strokeWidth">
          {#if item.line.start === "arrow"}<path d="M0,0 L6,3 L0,6 Z" fill={item.stroke ?? "currentColor"} />{/if}
          {#if item.line.start === "dot"}<circle cx="3" cy="3" r="2.5" fill={item.stroke ?? "currentColor"} />{/if}
        </marker>
      </defs>
      <line
        x1={lineBox.x1}
        y1={lineBox.y1}
        x2={lineBox.x2}
        y2={lineBox.y2}
        stroke={item.stroke ?? "var(--token-ink-primary)"}
        stroke-width={Math.max(1, item.strokeWidth)}
        stroke-dasharray={dashArray}
        stroke-linecap="round"
        marker-end={item.line.end === "none" ? undefined : `url(#end-${item.id})`}
        marker-start={item.line.start === "none" ? undefined : `url(#start-${item.id})`}
        style={item.shadow ? `filter: drop-shadow(${item.shadow})` : undefined}
      />
      <line class="hit" x1={lineBox.x1} y1={lineBox.y1} x2={lineBox.x2} y2={lineBox.y2} stroke="transparent" stroke-width={Math.max(14, item.strokeWidth + 10)} />
    </svg>
  </div>
{:else if item.type === "group"}
  <div class="item item-group" data-item={item.id} style={placement} aria-hidden="true"></div>
{:else}
  <div
    class="item"
    class:is-locked={item.locked}
    class:is-clipped={item.overflow === "clip"}
    data-item={item.id}
    style={placement}
  >
    {#if item.type === "shape"}
      <svg class="fill" width={box.width} height={box.height} aria-hidden="true" style={item.shadow ? `filter: drop-shadow(${item.shadow})` : undefined}>
        {#if item.shape === "ellipse"}
          <ellipse cx={box.width / 2} cy={box.height / 2} rx={box.width / 2 - inset} ry={box.height / 2 - inset} fill={item.fill ?? "transparent"} stroke={item.stroke} stroke-width={item.strokeWidth} stroke-dasharray={dashArray} />
        {:else if shapePath}
          <path d={shapePath} fill={item.fill ?? "transparent"} stroke={item.stroke} stroke-width={item.strokeWidth} stroke-dasharray={dashArray} stroke-linejoin="round" />
        {:else}
          <rect x={inset} y={inset} width={Math.max(0, box.width - inset * 2)} height={Math.max(0, box.height - inset * 2)} rx={item.radius} fill={item.fill ?? "transparent"} stroke={item.stroke} stroke-width={item.strokeWidth} stroke-dasharray={dashArray} />
        {/if}
      </svg>
    {:else if item.type === "text"}
      <div
        class="fill plate"
        style="background: {item.fill ?? 'transparent'}; border: {item.strokeWidth}px {item.dash} {item.stroke ?? 'transparent'}; border-radius: {item.radius}px;"
      ></div>
    {:else if item.type === "image" && item.image}
      {#if item.image.src}
        <img class="fill picture" src={item.image.src} alt={item.image.alt} style="border-radius: {item.radius}px;" draggable="false" />
      {:else}
        <div class="fill picture placeholder" style="border-radius: {item.radius}px;">{item.image.alt || "Picture"}</div>
      {/if}
    {:else if item.type === "table" && item.table}
      {@const columns = Math.max(1, item.table.columns)}
      {@const rowCount = Math.max(1, item.table.rows.length)}
      {@const widths = item.table.columnWidths?.length === columns ? item.table.columnWidths : undefined}
      {@const heights = item.table.rowHeights?.length === rowCount ? item.table.rowHeights : undefined}
      <div
        class="fill grid"
        style="grid-template-columns: {widths ? widths.map((width) => `${Math.max(0.01, width)}fr`).join(' ') : `repeat(${columns}, minmax(0, 1fr))`}; grid-template-rows: {heights ? heights.map((height) => `${Math.max(0.01, height)}fr`).join(' ') : `repeat(${rowCount}, minmax(0, 1fr))`}; border-top: {border}px {item.dash} {rule}; border-left: {border}px {item.dash} {rule};"
      >
        {#each item.table.rows as row, rowIndex (rowIndex)}
          {#each row as cell (cell.id)}
            <div
              class="cell"
              class:is-header={cell.header}
              class:is-picked={cells.includes(cell.id)}
              class:is-middle={cell.text?.valign === "middle"}
              class:is-bottom={cell.text?.valign === "bottom"}
              data-cell={cell.id}
              style="grid-row: {cell.row + 1} / span {cell.rowSpan}; grid-column: {cell.column + 1} / span {cell.columnSpan}; background: {cell.fill ?? (cell.header ? 'var(--token-surface-panel-hover)' : 'var(--token-surface-elevated)')}; padding: {(cell.text?.padding ?? 12) / 2}px; border-right: {border}px {item.dash} {rule}; border-bottom: {border}px {item.dash} {rule};"
            >
              {#if cell.border}
                <span class="rim" style="border: {cell.border.width}px {cell.border.style} {cell.border.color};"></span>
              {/if}
              {#if cell.text}
                <SlideSurfaceText text={cell.text} editing={textFor(cell.text.blockId)} {onedit} oncaret={(from, to) => oncaret?.(cell.text!.blockId, from, to)} {onexit} />
              {/if}
            </div>
          {/each}
        {/each}
      </div>
    {:else if item.type === "chart"}
      <div class="fill placeholder chart">Chart</div>
    {/if}

    {#if item.text && item.type !== "table"}
      <div
        bind:this={prose}
        class="prose"
        class:is-middle={item.text.valign === "middle"}
        class:is-bottom={item.text.valign === "bottom"}
        style="padding: {textInset};"
      >
        <SlideSurfaceText
          text={item.text}
          editing={textFor(item.text.blockId)}
          fit={item.overflow === "shrink"}
          {onedit}
          oncaret={(from, to) => oncaret?.(item.text!.blockId, from, to)}
          {onexit}
        />
      </div>
    {/if}
  </div>
{/if}

<style>
  .item {
    position: absolute;
    box-sizing: border-box;
    transform-origin: center;
    cursor: move;
  }

  .item.is-locked {
    pointer-events: none;
  }

  .item.is-clipped {
    overflow: hidden;
  }

  .item-group {
    pointer-events: none;
  }

  .fill {
    position: absolute;
    inset: 0;
    display: block;
  }

  .plate {
    box-sizing: border-box;
  }

  .picture {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px dashed var(--token-border-strong);
    background: var(--token-surface-panel);
    color: var(--token-ink-muted);
    font-family: var(--token-font-sans);
    font-size: 20px;
  }

  .grid {
    display: grid;
    box-sizing: border-box;
    overflow: hidden;
  }

  .cell {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    box-sizing: border-box;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .cell.is-middle {
    justify-content: center;
  }

  .cell.is-bottom {
    justify-content: flex-end;
  }

  .rim {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    pointer-events: none;
  }

  .cell.is-picked::after {
    content: "";
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--token-color-active-fill) 18%, transparent);
    box-shadow: inset 0 0 0 2px var(--token-color-active-border);
    pointer-events: none;
  }

  .prose {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    box-sizing: border-box;
    overflow: hidden;
  }

  .prose.is-middle {
    justify-content: center;
  }

  .prose.is-bottom {
    justify-content: flex-end;
  }

  .hit {
    pointer-events: stroke;
    cursor: move;
  }
</style>

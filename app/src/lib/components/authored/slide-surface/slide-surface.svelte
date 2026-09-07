<script lang="ts">
  import MessageSquare from "@lucide/svelte/icons/message-square";

  import SlideSurfaceItem from "$authored-components/slide-surface/slide-surface-item.svelte";
  import type {
    SurfaceBadge,
    SurfaceCell,
    SurfaceFrame,
    SurfaceGuide,
    SurfaceItem,
    SurfaceMove,
    SurfacePoint,
    SurfaceScene,
    SurfaceTextEdit
  } from "$authored-components/slide-surface/slide-surface-types";

  type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

  type Gesture =
    | { kind: "idle" }
    | { kind: "press"; id: string; at: SurfacePoint; additive: boolean; cell?: string }
    | { kind: "move"; ids: string[]; origin: Map<string, SurfaceFrame>; at: SurfacePoint; primary: string }
    | { kind: "resize"; id: string; handle: Handle; origin: SurfaceFrame; at: SurfacePoint }
    | { kind: "rotate"; id: string; centre: SurfacePoint; start: number; origin: number }
    | { kind: "endpoint"; id: string; which: "from" | "to"; other: SurfacePoint }
    | { kind: "marquee"; at: SurfacePoint; to: SurfacePoint }
    | { kind: "cells"; id: string; from: SurfaceCell; to: SurfaceCell };

  let {
    scene,
    width,
    height,
    selected = [],
    cells = [],
    editing,
    badges = [],
    interactive = true,
    placing = false,
    board,
    onselect,
    onselectcells,
    onclear,
    onplace,
    onframes,
    onrotate,
    online,
    ongrow,
    onenter,
    onexit,
    onedit,
    oncaret,
    onbadge,
    oncontext,
    snap
  }: {
    scene: SurfaceScene;
    width: number;
    height: number;
    selected?: readonly string[];
    cells?: readonly string[];
    editing?: string;
    badges?: readonly SurfaceBadge[];
    interactive?: boolean;
    placing?: boolean;
    board?: HTMLElement;
    onselect?: (ids: string[], additive: boolean) => void;
    onselectcells?: (tableId: string, cellIds: string[]) => void;
    onclear?: () => void;
    onplace?: (at: SurfacePoint) => void;
    onframes?: (moves: SurfaceMove[], final: boolean) => void;
    onrotate?: (id: string, rotation: number, final: boolean) => void;
    online?: (id: string, from: SurfacePoint, to: SurfacePoint, final: boolean) => void;
    ongrow?: (id: string, height: number) => void;
    onenter?: (id: string, blockId: string) => void;
    onexit?: () => void;
    onedit?: (edit: SurfaceTextEdit) => void;
    oncaret?: (blockId: string, from: number, to: number) => void;
    onbadge?: (id: string) => void;
    oncontext?: (at: SurfacePoint, id: string | undefined) => void;
    snap?: (frame: SurfaceFrame, id: string, alt: boolean) => { frame: SurfaceFrame; guides: SurfaceGuide[] };
  } = $props();

  const HANDLES: readonly Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const PRESS_SLOP = 3;
  const MIN_SIZE = 0.01;

  let stage = $state<HTMLDivElement>();
  let gesture = $state<Gesture>({ kind: "idle" });
  let drafts = $state<Map<string, SurfaceFrame>>(new Map());
  let draftRotation = $state<{ id: string; rotation: number } | undefined>(undefined);
  let draftLine = $state<{ id: string; from: SurfacePoint; to: SurfacePoint } | undefined>(undefined);
  let guides = $state<SurfaceGuide[]>([]);
  let hovered = $state<string | undefined>(undefined);

  const units = $derived(scene.units);
  const scale = $derived(units.width === 0 ? 1 : width / units.width);
  const byId = $derived(new Map(scene.items.map((item) => [item.id, item])));

  const frameOf = (item: SurfaceItem): SurfaceFrame => drafts.get(item.id) ?? item.frame;
  const rotationOf = (item: SurfaceItem): number =>
    draftRotation?.id === item.id ? draftRotation.rotation : item.rotation;

  const lineOf = (item: SurfaceItem) =>
    draftLine?.id === item.id ? { ...item.line!, from: draftLine.from, to: draftLine.to } : item.line;

  const shown = $derived(
    scene.items.map((item) => ({
      item,
      frame: frameOf(item),
      rotation: rotationOf(item),
      drawn: item.line && lineOf(item) !== item.line ? { ...item, line: lineOf(item) } : item
    }))
  );

  const topLevel = (id: string): string => {
    const item = byId.get(id);
    if (!item || item.parents.length === 0 || selected.includes(id)) return id;
    return item.parents[0];
  };

  const toUnits = (event: MouseEvent): SurfacePoint => {
    const rect = stage?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
  };

  const toFraction = (point: SurfacePoint): SurfacePoint => ({ x: point.x / units.width, y: point.y / units.height });

  const itemAt = (target: EventTarget | null): string | undefined => {
    if (!(target instanceof Element)) return undefined;
    const host = target.closest("[data-item]");
    return host instanceof HTMLElement ? host.dataset.item : undefined;
  };

  const cellAt = (target: EventTarget | null): string | undefined => {
    if (!(target instanceof Element)) return undefined;
    const host = target.closest("[data-cell]");
    return host instanceof HTMLElement ? host.dataset.cell : undefined;
  };

  const cellIn = (item: SurfaceItem | undefined, cellId: string | undefined): SurfaceCell | undefined =>
    cellId === undefined ? undefined : item?.table?.rows.flat().find((cell) => cell.id === cellId);

  const editable = (item: SurfaceItem | undefined) => item?.text !== undefined || item?.type === "table";

  const startMarquee = (event: PointerEvent) => {
    const at = toUnits(event);
    gesture = { kind: "marquee", at, to: at };
    stage?.setPointerCapture(event.pointerId);
  };

  const pointerDown = (event: PointerEvent) => {
    if (!interactive || event.button !== 0) return;
    const at = toUnits(event);

    if (placing) {
      onplace?.(toFraction(at));
      return;
    }

    const hit = itemAt(event.target);

    if (editing !== undefined) {
      const within = event.target instanceof Element ? (event.target.closest("[data-block]") as HTMLElement | null)?.dataset.block : undefined;
      if (within === editing) return;
      onexit?.();
    }

    if (hit === undefined) {
      if (event.target instanceof Element && event.target.closest("[data-handle], [data-badge], [data-rotate], [data-endpoint]")) return;
      startMarquee(event);
      return;
    }

    const id = topLevel(hit);
    const item = byId.get(id);
    const cell = item?.type === "table" ? cellIn(item, cellAt(event.target)) : undefined;
    const alone = selected.length === 1 && selected[0] === id;

    if (cell !== undefined && alone && cells.length > 0) {
      gesture = { kind: "cells", id, from: cell, to: cell };
      stage?.setPointerCapture(event.pointerId);
      return;
    }

    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    if (!selected.includes(id)) onselect?.(additive ? [...selected, id] : [id], additive);
    else if (additive) {
      onselect?.(selected.filter((held) => held !== id), true);
      return;
    }
    gesture = { kind: "press", id, at, additive, cell: alone && cell !== undefined ? cell.id : undefined };
    stage?.setPointerCapture(event.pointerId);
  };

  $effect(() => {
    const element = board;
    if (element === undefined || !interactive) return;
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || placing || stage === undefined) return;
      if (event.target instanceof Node && stage.contains(event.target)) return;
      if (editing !== undefined) onexit?.();
      startMarquee(event);
    };
    element.addEventListener("pointerdown", down);
    return () => element.removeEventListener("pointerdown", down);
  });

  const startHandle = (event: PointerEvent, id: string, handle: Handle) => {
    if (!interactive) return;
    event.stopPropagation();
    const item = byId.get(id);
    if (!item) return;
    gesture = { kind: "resize", id, handle, origin: frameOf(item), at: toUnits(event) };
    stage?.setPointerCapture(event.pointerId);
  };

  const startRotate = (event: PointerEvent, id: string) => {
    if (!interactive) return;
    event.stopPropagation();
    const item = byId.get(id);
    if (!item) return;
    const frame = frameOf(item);
    const centre = { x: (frame.x + frame.width / 2) * units.width, y: (frame.y + frame.height / 2) * units.height };
    const at = toUnits(event);
    gesture = { kind: "rotate", id, centre, start: Math.atan2(at.y - centre.y, at.x - centre.x), origin: rotationOf(item) };
    stage?.setPointerCapture(event.pointerId);
  };

  const startEndpoint = (event: PointerEvent, id: string, which: "from" | "to") => {
    if (!interactive) return;
    event.stopPropagation();
    const item = byId.get(id);
    if (!item?.line) return;
    gesture = { kind: "endpoint", id, which, other: which === "from" ? item.line.to : item.line.from };
    stage?.setPointerCapture(event.pointerId);
  };

  const resized = (origin: SurfaceFrame, handle: Handle, dx: number, dy: number, keep: boolean, centred: boolean): SurfaceFrame => {
    let { x, y, width: w, height: h } = origin;
    const west = handle.includes("w");
    const east = handle.includes("e");
    const north = handle.includes("n");
    const south = handle.includes("s");
    if (east) w = origin.width + dx;
    if (west) { w = origin.width - dx; x = origin.x + dx; }
    if (south) h = origin.height + dy;
    if (north) { h = origin.height - dy; y = origin.y + dy; }
    if (centred) {
      if (east || west) { const grow = w - origin.width; w = origin.width + grow * 2; x = origin.x - grow; }
      if (north || south) { const grow = h - origin.height; h = origin.height + grow * 2; y = origin.y - grow; }
    }
    if (keep && (east || west) && (north || south)) {
      const ratio = origin.width / origin.height;
      if (Math.abs(w / ratio - h) > 0) {
        const targetH = w / ratio;
        if (north) y = y + (h - targetH);
        h = targetH;
      }
    }
    if (w < MIN_SIZE) { if (west) x = origin.x + origin.width - MIN_SIZE; w = MIN_SIZE; }
    if (h < MIN_SIZE) { if (north) y = origin.y + origin.height - MIN_SIZE; h = MIN_SIZE; }
    return { x, y, width: w, height: h };
  };

  const pointerMove = (event: PointerEvent) => {
    const at = toUnits(event);
    const held = gesture;

    if (held.kind === "idle") {
      const hit = itemAt(event.target);
      hovered = hit === undefined ? undefined : topLevel(hit);
      return;
    }

    if (held.kind === "press") {
      if (Math.hypot(at.x - held.at.x, at.y - held.at.y) < PRESS_SLOP) return;
      const ids = selected.includes(held.id) ? [...selected] : [held.id];
      const origin = new Map(ids.flatMap((id) => { const item = byId.get(id); return item ? [[id, item.frame] as const] : []; }));
      gesture = { kind: "move", ids, origin, at: held.at, primary: held.id };
      return;
    }

    if (held.kind === "move") {
      const dx = (at.x - held.at.x) / units.width;
      const dy = (at.y - held.at.y) / units.height;
      const primaryOrigin = held.origin.get(held.primary);
      let snapDx = dx;
      let snapDy = dy;
      let found: SurfaceGuide[] = [];
      if (primaryOrigin && snap) {
        const proposed = { ...primaryOrigin, x: primaryOrigin.x + dx, y: primaryOrigin.y + dy };
        const result = snap(proposed, held.primary, event.altKey);
        snapDx = result.frame.x - primaryOrigin.x;
        snapDy = result.frame.y - primaryOrigin.y;
        found = result.guides;
      }
      const next = new Map<string, SurfaceFrame>();
      for (const [id, origin] of held.origin) next.set(id, { ...origin, x: origin.x + snapDx, y: origin.y + snapDy });
      drafts = next;
      guides = found;
      return;
    }

    if (held.kind === "resize") {
      const dx = (at.x - held.at.x) / units.width;
      const dy = (at.y - held.at.y) / units.height;
      drafts = new Map([[held.id, resized(held.origin, held.handle, dx, dy, event.shiftKey, event.altKey)]]);
      return;
    }

    if (held.kind === "rotate") {
      const angle = Math.atan2(at.y - held.centre.y, at.x - held.centre.x);
      let degrees = held.origin + ((angle - held.start) * 180) / Math.PI;
      if (event.shiftKey) degrees = Math.round(degrees / 15) * 15;
      degrees = ((Math.round(degrees) % 360) + 360) % 360;
      draftRotation = { id: held.id, rotation: degrees };
      return;
    }

    if (held.kind === "endpoint") {
      const point = toFraction(at);
      const clamped = { x: Math.min(Math.max(point.x, 0), 1), y: Math.min(Math.max(point.y, 0), 1) };
      draftLine = held.which === "from" ? { id: held.id, from: clamped, to: held.other } : { id: held.id, from: held.other, to: clamped };
      return;
    }

    if (held.kind === "cells") {
      const under = document.elementFromPoint(event.clientX, event.clientY);
      if (itemAt(under) !== held.id) return;
      const cell = cellIn(byId.get(held.id), cellAt(under));
      if (cell && cell.id !== held.to.id) gesture = { ...held, to: cell };
      return;
    }

    if (held.kind === "marquee") {
      gesture = { ...held, to: at };
    }
  };

  const contains = (box: SurfaceFrame, frame: SurfaceFrame) =>
    frame.x >= box.x && frame.y >= box.y && frame.x + frame.width <= box.x + box.width && frame.y + frame.height <= box.y + box.height;

  const cellsBetween = (item: SurfaceItem | undefined, from: SurfaceCell, to: SurfaceCell): string[] => {
    const top = Math.min(from.row, to.row);
    const left = Math.min(from.column, to.column);
    const bottom = Math.max(from.row + from.rowSpan - 1, to.row + to.rowSpan - 1);
    const right = Math.max(from.column + from.columnSpan - 1, to.column + to.columnSpan - 1);
    const inside = (item?.table?.rows.flat() ?? [])
      .filter((cell) => cell.row <= bottom && cell.row + cell.rowSpan - 1 >= top && cell.column <= right && cell.column + cell.columnSpan - 1 >= left)
      .map((cell) => cell.id);
    return [from.id, ...inside.filter((id) => id !== from.id)];
  };

  const liveCells = $derived(gesture.kind === "cells" ? cellsBetween(byId.get(gesture.id), gesture.from, gesture.to) : cells);

  const pointerUp = (event: PointerEvent) => {
    const held = gesture;
    gesture = { kind: "idle" };
    guides = [];
    if (stage?.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);

    if (held.kind === "press") {
      if (held.cell !== undefined) onselectcells?.(held.id, [held.cell]);
      else if (!held.additive && (selected.length !== 1 || selected[0] !== held.id)) {
        // Keep the whole selection available while a drag starts, then collapse
        // an unmodified click to the one object when the pointer never moved.
        onselect?.([held.id], false);
      }
      return;
    }
    if (held.kind === "move") {
      const moves = [...drafts].map(([id, frame]) => ({ id, frame }));
      drafts = new Map();
      if (moves.length > 0) onframes?.(moves, true);
      return;
    }
    if (held.kind === "resize") {
      const frame = drafts.get(held.id);
      drafts = new Map();
      if (frame) onframes?.([{ id: held.id, frame }], true);
      return;
    }
    if (held.kind === "rotate") {
      const rotation = draftRotation?.rotation;
      draftRotation = undefined;
      if (rotation !== undefined) onrotate?.(held.id, rotation, true);
      return;
    }
    if (held.kind === "endpoint") {
      const line = draftLine;
      draftLine = undefined;
      if (line) online?.(held.id, line.from, line.to, true);
      return;
    }
    if (held.kind === "cells") {
      onselectcells?.(held.id, cellsBetween(byId.get(held.id), held.from, held.to));
      return;
    }
    if (held.kind === "marquee") {
      const a = held.at;
      const b = held.to;
      if (Math.hypot(b.x - a.x, b.y - a.y) < PRESS_SLOP) {
        onclear?.();
        return;
      }
      const box = {
        x: Math.min(a.x, b.x) / units.width,
        y: Math.min(a.y, b.y) / units.height,
        width: Math.abs(b.x - a.x) / units.width,
        height: Math.abs(b.y - a.y) / units.height
      };
      const ids = scene.items
        .filter((item) => item.depth === 0 && !item.locked && contains(box, item.frame))
        .map((item) => item.id);
      if (ids.length > 0) onselect?.(ids, false);
      else onclear?.();
    }
  };

  const context = (event: MouseEvent) => {
    if (!interactive) return;
    const hit = itemAt(document.elementFromPoint(event.clientX, event.clientY));
    oncontext?.(toFraction(toUnits(event)), hit);
  };

  const doubleClick = (event: MouseEvent) => {
    if (!interactive || placing) return;
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const hit = itemAt(under);
    if (hit === undefined) return;
    const item = byId.get(hit);
    if (!item) return;
    if (item.parents.length > 0 && !selected.includes(hit)) {
      onselect?.([hit], false);
      return;
    }
    if (item.type === "table") {
      const cell = cellAt(under);
      const block = item.table?.rows.flat().find((held) => held.id === cell)?.text?.blockId;
      if (block) onenter?.(hit, block);
      return;
    }
    if (editable(item) && item.text) onenter?.(hit, item.text.blockId);
  };

  const marqueeBox = $derived.by(() => {
    if (gesture.kind !== "marquee") return undefined;
    const { at, to } = gesture;
    return { left: Math.min(at.x, to.x), top: Math.min(at.y, to.y), width: Math.abs(to.x - at.x), height: Math.abs(to.y - at.y) };
  });

  const outlineFor = (item: SurfaceItem) => {
    const frame = frameOf(item);
    return { left: frame.x * units.width, top: frame.y * units.height, width: frame.width * units.width, height: frame.height * units.height, rotation: rotationOf(item) };
  };

  const handlePosition = (handle: Handle, w: number, h: number) => {
    const x = handle.includes("w") ? 0 : handle.includes("e") ? w : w / 2;
    const y = handle.includes("n") ? 0 : handle.includes("s") ? h : h / 2;
    return `left: ${x}px; top: ${y}px;`;
  };

  const cursorFor = (handle: Handle) =>
    ({ nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" })[handle];

  const badgeOf = (id: string) => badges.find((badge) => badge.id === id);
  const slideBadge = $derived(badges.find((badge) => badge.id === ""));
  const single = $derived(selected.length === 1 ? byId.get(selected[0]) : undefined);
  const handleSize = $derived(9 / scale);
  const busy = $derived(gesture.kind !== "idle");
  const hoverItem = $derived(
    hovered !== undefined && !busy && editing === undefined && !placing && !selected.includes(hovered) ? byId.get(hovered) : undefined
  );

  const grow = (id: string, heightUnits: number) => {
    if (units.height > 0) ongrow?.(id, heightUnits / units.height);
  };
</script>

<div class="frame" style="width: {width}px; height: {height}px;">
  <div
    bind:this={stage}
    class="stage"
    class:is-idle={gesture.kind === "idle"}
    class:is-moving={gesture.kind === "move"}
    class:is-placing={placing}
    style="width: {units.width}px; height: {units.height}px; transform: scale({scale}); background: {scene.background};"
    role="application"
    aria-label="Slide"
    onpointerdown={pointerDown}
    onpointermove={pointerMove}
    onpointerup={pointerUp}
    onpointercancel={pointerUp}
    onpointerleave={() => (hovered = undefined)}
    ondblclick={doubleClick}
    oncontextmenu={context}
  >
    {#each shown as { item, frame, rotation, drawn } (item.id)}
      <SlideSurfaceItem item={drawn} {frame} {rotation} {units} {scale} {editing} cells={liveCells} {busy} {onedit} {oncaret} {onexit} ongrow={grow} />
    {/each}

    <div class="overlay" aria-hidden="true">
      {#each guides as guide, index (index)}
        {#if guide.axis === "x"}
          <div class="guide guide-x" style="left: {guide.at * units.width}px;"><span style="font-size: {11 / scale}px">{guide.label}</span></div>
        {:else}
          <div class="guide guide-y" style="top: {guide.at * units.height}px;"><span style="font-size: {11 / scale}px">{guide.label}</span></div>
        {/if}
      {/each}

      {#each scene.items as item (item.id)}
        {@const badge = badgeOf(item.id)}
        {#if badge && badge.count > 0 && item.type !== "line"}
          {@const box = outlineFor(item)}
          {@const pad = 4 / scale}
          <div
            class="commented"
            style="left: {box.left - pad}px; top: {box.top - pad}px; width: {box.width + pad * 2}px; height: {box.height + pad * 2}px; rotate: {box.rotation}deg; border-width: {1.5 / scale}px;"
          ></div>
        {/if}
      {/each}

      {#if hoverItem && hoverItem.type !== "line"}
        {@const box = outlineFor(hoverItem)}
        <div
          class="outline is-hover"
          style="left: {box.left}px; top: {box.top}px; width: {box.width}px; height: {box.height}px; rotate: {box.rotation}deg; border-width: {1 / scale}px;"
        ></div>
      {/if}

      {#each selected as id (id)}
        {@const item = byId.get(id)}
        {#if item && item.type !== "line"}
          {@const box = outlineFor(item)}
          <div
            class="outline"
            class:is-group={item.type === "group"}
            style="left: {box.left}px; top: {box.top}px; width: {box.width}px; height: {box.height}px; rotate: {box.rotation}deg; border-width: {1.5 / scale}px;"
          >
            {#if single && single.id === id && !single.locked && editing === undefined}
              {#each HANDLES as handle (handle)}
                <button
                  type="button"
                  class="handle"
                  data-handle={handle}
                  aria-label="Resize {handle}"
                  style="{handlePosition(handle, box.width, box.height)} width: {handleSize}px; height: {handleSize}px; cursor: {cursorFor(handle)}; border-width: {1.5 / scale}px;"
                  onpointerdown={(event) => startHandle(event, id, handle)}
                ></button>
              {/each}
              <button
                type="button"
                class="rotate"
                data-rotate
                aria-label="Rotate"
                style="left: {box.width / 2}px; top: {-22 / scale}px; width: {handleSize + 2 / scale}px; height: {handleSize + 2 / scale}px; border-width: {1.5 / scale}px;"
                onpointerdown={(event) => startRotate(event, id)}
              ></button>
              <div class="stem" style="left: {box.width / 2}px; top: {-22 / scale}px; height: {22 / scale}px; width: {1 / scale}px;"></div>
            {/if}
          </div>
        {:else if item && item.line}
          {@const line = lineOf(item) ?? item.line}
          <button type="button" class="handle endpoint" data-endpoint="from" aria-label="Line start" style="left: {line.from.x * units.width}px; top: {line.from.y * units.height}px; width: {handleSize + 2 / scale}px; height: {handleSize + 2 / scale}px; border-width: {1.5 / scale}px;" onpointerdown={(event) => startEndpoint(event, id, "from")}></button>
          <button type="button" class="handle endpoint" data-endpoint="to" aria-label="Line end" style="left: {line.to.x * units.width}px; top: {line.to.y * units.height}px; width: {handleSize + 2 / scale}px; height: {handleSize + 2 / scale}px; border-width: {1.5 / scale}px;" onpointerdown={(event) => startEndpoint(event, id, "to")}></button>
        {/if}
      {/each}

      {#if marqueeBox}
        <div class="marquee" style="left: {marqueeBox.left}px; top: {marqueeBox.top}px; width: {marqueeBox.width}px; height: {marqueeBox.height}px; border-width: {1 / scale}px;"></div>
      {/if}
    </div>

    {#each scene.items as item (item.id)}
      {@const badge = badgeOf(item.id)}
      {#if badge && badge.count > 0}
        {@const box = outlineFor(item)}
        <button
          type="button"
          class="badge"
          data-badge={item.id}
          aria-label="{badge.count} comment{badge.count === 1 ? '' : 's'}"
          title="{badge.count} comment{badge.count === 1 ? '' : 's'}"
          style="left: {box.left + box.width}px; top: {box.top}px; transform: translate(-50%, -50%) scale({1 / scale}); transform-origin: 50% 50%;"
          onpointerdown={(event) => event.stopPropagation()}
          onclick={(event) => { event.stopPropagation(); onbadge?.(item.id); }}
        >
          <MessageSquare size={12} aria-hidden="true" />
        </button>
      {/if}
    {/each}
  </div>

  {#if slideBadge && slideBadge.count > 0}
    <button type="button" class="badge slide-badge" data-badge="" aria-label="{slideBadge.count} comments on this slide" title="{slideBadge.count} comment{slideBadge.count === 1 ? '' : 's'} on this slide" onclick={() => onbadge?.("")}>
      <MessageSquare size={12} aria-hidden="true" />
    </button>
  {/if}
</div>

<style>
  .frame {
    position: relative;
    flex-shrink: 0;
    box-shadow: var(--token-shadow-raised);
    border: 1px solid var(--token-border-subtle);
    box-sizing: content-box;
  }

  .stage {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
    overflow: visible;
    touch-action: none;
    user-select: none;
  }

  .stage.is-idle {
    cursor: default;
  }

  .stage.is-moving,
  .stage.is-moving :global(.item) {
    cursor: move;
  }

  .stage.is-placing,
  .stage.is-placing :global(.item) {
    cursor: crosshair;
  }

  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: visible;
  }

  .outline {
    position: absolute;
    box-sizing: border-box;
    border-style: solid;
    border-color: var(--token-color-active-border);
    transform-origin: center;
    pointer-events: none;
  }

  .outline.is-group {
    border-style: dashed;
  }

  .outline.is-hover {
    border-color: var(--token-color-interactive-border);
  }

  .commented {
    position: absolute;
    box-sizing: border-box;
    border-style: dashed;
    border-color: var(--token-color-attention-border);
    transform-origin: center;
    pointer-events: none;
  }

  .handle,
  .rotate {
    position: absolute;
    box-sizing: border-box;
    padding: 0;
    border-style: solid;
    border-color: var(--token-color-active-border);
    background: var(--token-surface-elevated);
    transform: translate(-50%, -50%);
    pointer-events: auto;
  }

  .handle {
    border-radius: 1px;
  }

  .rotate,
  .endpoint {
    border-radius: 50%;
    cursor: grab;
  }

  .stem {
    position: absolute;
    background: var(--token-color-active-border);
    transform: translateX(-50%);
  }

  .guide {
    position: absolute;
    background: var(--token-color-accent-1-fill);
  }

  .guide-x {
    top: 0;
    bottom: 0;
    width: 1px;
  }

  .guide-y {
    left: 0;
    right: 0;
    height: 1px;
  }

  .guide span {
    position: absolute;
    left: 4px;
    top: 4px;
    padding: 0 4px;
    border-radius: 2px;
    background: var(--token-surface-elevated);
    color: var(--token-color-accent-1-text);
    font-family: var(--token-font-mono);
    white-space: nowrap;
  }

  .guide-y span {
    left: auto;
    right: 4px;
    top: 4px;
  }

  .marquee {
    position: absolute;
    border-style: dashed;
    border-color: var(--token-color-active-border);
    background: color-mix(in srgb, var(--token-color-active-fill) 10%, transparent);
  }

  .badge {
    position: absolute;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 2px solid var(--token-surface-elevated);
    border-radius: 11px;
    background: var(--token-color-attention-fill);
    color: var(--token-color-attention-on-fill);
    box-shadow: var(--token-shadow-panel);
    cursor: pointer;
    pointer-events: auto;
  }

  .slide-badge {
    right: -10px;
    top: -10px;
    transform: none;
  }
</style>

<script lang="ts">
  import { tick, type Component } from "svelte";
  import ChartColumn from "@lucide/svelte/icons/chart-column";
  import ChevronLeft from "@lucide/svelte/icons/chevron-left";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import Circle from "@lucide/svelte/icons/circle";
  import Diamond from "@lucide/svelte/icons/diamond";
  import ImageIcon from "@lucide/svelte/icons/image";
  import MessageSquare from "@lucide/svelte/icons/message-square";
  import Minus from "@lucide/svelte/icons/minus";
  import MoveUpRight from "@lucide/svelte/icons/move-up-right";
  import Plus from "@lucide/svelte/icons/plus";
  import Slash from "@lucide/svelte/icons/slash";
  import Square from "@lucide/svelte/icons/square";
  import StickyNote from "@lucide/svelte/icons/sticky-note";
  import TableIcon from "@lucide/svelte/icons/table";
  import Triangle from "@lucide/svelte/icons/triangle";
  import Type from "@lucide/svelte/icons/type";

  import {
    SlideSurface,
    type SurfaceBadge,
    type SurfaceFrame,
    type SurfaceGuide,
    type SurfaceMove,
    type SurfacePoint,
    type SurfaceTextEdit
  } from "$authored-components/slide-surface";
  import { Button } from "$vendored-components/button";
  import * as ContextMenu from "$vendored-components/context-menu";
  import { rowsOf } from "$app-views/categories/slide-deck-editor/procedures/comments";
  import {
    blockIn,
    boundsOf,
    elementIn,
    emptyText,
    placedById,
    placedOn,
    slideIndexOf,
    textOf,
    withDuplicatedElements,
    withElementFrame,
    withGrouped,
    withInsertedElements,
    withSet,
    withSets,
    withUngrouped,
    withoutElements,
    type SlideElement
  } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import {
    INSERT_GROUPS,
    frameFor,
    makeElement,
    type InsertEntry,
    type PlacedKind
  } from "$app-views/categories/slide-deck-editor/procedures/inserting";
  import { nudged } from "$app-views/categories/slide-deck-editor/procedures/arrange";
  import { arm, placing } from "$app-views/categories/slide-deck-editor/procedures/placing.svelte";
  import { sceneOf } from "$app-views/categories/slide-deck-editor/procedures/scene";
  import {
    cellsSignal,
    elementsSignal,
    notesSignal,
    rangeOf,
    sameSelection,
    selectedCells,
    selectedIds,
    slideSignal,
    textSignal,
    threadsSignal
  } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { snapped, targetsOf } from "$app-views/categories/slide-deck-editor/procedures/snapping";
  import {
    clampZoom,
    drawn,
    fitted,
    percent,
    slideUnits
  } from "$app-views/categories/slide-deck-editor/procedures/stage";
  import { replaced, toggledMark } from "$app-views/categories/slide-deck-editor/procedures/typing";
  import {
    readStore,
    workspaceState,
    type SlideDeckRuntime,
    type SyncState
  } from "$model/client/workspace-state";

  const GUTTER = 24;
  const WHEEL_NOTCH = 120;
  const PERCENT_PER_NOTCH = 2;
  const SNAP = 0.006;

  const ICON: Record<string, Component> = {
    text: Type,
    rectangle: Square,
    ellipse: Circle,
    triangle: Triangle,
    diamond: Diamond,
    arrow: MoveUpRight,
    callout: MessageSquare,
    line: Slash,
    image: ImageIcon,
    table: TableIcon,
    chart: ChartColumn
  };

  const SYNC_LABEL: Record<SyncState, string> = {
    loading: "Loading",
    saved: "Saved",
    saving: "Saving",
    rebasing: "Rebasing",
    "needs-review": "Needs review",
    offline: "Offline",
    error: "Not saved"
  };

  const view = workspaceState();

  const deckId = $derived(view.active.resourceId);
  const decksQuery = readStore("slideDecks");

  const deckTitle = $derived.by(() => {
    if (deckId === undefined) return undefined;

    if (!decksQuery.ready) return undefined;

    const found = decksQuery.current;
    if (found?.kind !== "table" || found.table !== "slideDecks") return undefined;
    return found.rows.find((deck) => deck._id === deckId)?.title;
  });

  let runtime = $state<SlideDeckRuntime | undefined>(undefined);

  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const index = $derived(body === undefined ? 0 : slideIndexOf(body, view.active.focus ?? undefined));
  const slide = $derived(body?.slides[index]);
  const geometry = $derived(runtime?.stage);
  const units = $derived(
    body === undefined || geometry === undefined ? { width: 1280, height: 720 } : slideUnits(body.aspectRatio, geometry)
  );
  const scene = $derived(body === undefined ? undefined : sceneOf(body, slide, units));

  let surface = $state<HTMLDivElement>();
  let board = $state<HTMLDivElement>();
  let available = $state({ width: 0, height: 0 });

  $effect(() => {
    const element = surface;
    if (element === undefined) return;
    const measure = () => {
      available = { width: element.clientWidth, height: element.clientHeight };
    };
    const watcher = new ResizeObserver(measure);
    watcher.observe(element);
    measure();
    return () => watcher.disconnect();
  });

  const fit = $derived(body === undefined ? { width: 0, height: 0 } : fitted(available, body.aspectRatio, GUTTER));
  const size = $derived(drawn(fit, view.zoom));

  let editing = $state<string | undefined>(undefined);

  const holderOf = (blockId: string): string | undefined =>
    slide === undefined
      ? undefined
      : placedOn(slide).find(({ element }) => {
          const content = element.content;
          if ((content.type === "text" || content.type === "shape") && content.block?.id === blockId) return true;
          return content.type === "table" && content.block.rows.some((row) => row.cells.some((cell) => cell.blocks.some((held) => held.id === blockId)));
        })?.element.id;

  const selected = $derived.by(() => {
    if (slide === undefined) return [] as string[];
    const onSlide = new Set(placedOn(slide).map((placed) => placed.element.id));
    const chosen = selectedIds(view.selection).filter((id) => onSlide.has(id));
    if (chosen.length === 0 && editing !== undefined) {
      const holder = holderOf(editing);
      if (holder !== undefined) return [holder];
    }
    return chosen;
  });

  const cells = $derived(selectedCells(view.selection));

  const threadRows = readStore("commentThreads");

  const threads = $derived.by(() => {
    if (deckId === undefined) return [];
    return rowsOf(threadRows, "commentThreads").filter(
      (row) =>
        row.target.kind === "slides" &&
        row.target.id === deckId &&
        row.resolution === undefined
    );
  });

  const badges = $derived.by((): SurfaceBadge[] => {
    if (slide === undefined) return [];
    const counts = new Map<string, number>();
    for (const thread of threads) {
      const within = thread.within;
      if (within?.kind === "element" && within.elementId) counts.set(within.elementId, (counts.get(within.elementId) ?? 0) + 1);
      else if (within?.kind === "slide" && within.slideId === slide.id) counts.set("", (counts.get("") ?? 0) + 1);
    }
    return [...counts].map(([id, count]) => ({ id, count }));
  });

  const apply = (ops: readonly Parameters<SlideDeckRuntime["apply"]>[0][number][]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const show = (slideId: string) => {
    if (deckId === undefined) return;
    editing = undefined;
    view.open({ category: "slide-deck-editor", resourceId: deckId, focus: slideId });
    view.inspect("slide-deck-editor.slide", slideSignal(slideId).selection);
  };

  const select = (ids: string[]) => {
    if (body === undefined) return;
    editing = undefined;
    const elements = ids.flatMap((id) => {
      const element = elementIn(body, id);
      return element ? [element] : [];
    });
    const signal = elementsSignal(elements);
    if (signal) view.inspect(signal.key, signal.selection);
  };

  const pickCells = (tableId: string, ids: string[]) => {
    editing = undefined;
    const signal = cellsSignal(tableId, ids);
    view.inspect(signal.key, signal.selection);
  };

  const clear = () => {
    editing = undefined;
    if (slide) view.inspect("slide-deck-editor.slide", slideSignal(slide.id).selection);
    else view.clear();
  };

  const frames = (moves: SurfaceMove[]) => {
    if (body === undefined) return;
    let held = body;
    const ops = [];
    for (const move of moves) {
      const step = withElementFrame(held, move.id, move.frame);
      held = step.body;
      ops.push(...step.ops);
    }
    apply(ops);
  };

  const grow = (id: string, height: number) => {
    if (body === undefined || slide === undefined) return;
    const placed = placedById(slide, id);
    if (placed === undefined) return;
    const next = Math.round(height * 10000) / 10000;
    if (Math.abs(next - placed.frame.height) < 0.0005) return;
    apply(withElementFrame(body, id, { ...placed.frame, height: next }).ops);
  };

  const rotate = (id: string, rotation: number) => {
    if (body === undefined) return;
    apply(withSet(body, `${id}/rotation`, rotation === 0 ? null : rotation).ops);
  };

  const line = (id: string, from: SurfacePoint, to: SurfacePoint) => {
    if (body === undefined) return;
    apply(
      withSets(body, [
        { path: `${id}/content/from`, value: from },
        { path: `${id}/content/to`, value: to },
        { path: `${id}/frame`, value: boundsOf([{ x: from.x, y: from.y, width: 0, height: 0 }, { x: to.x, y: to.y, width: 0, height: 0 }]) }
      ]).ops
    );
  };

  const enter = (id: string, blockId: string) => {
    if (body === undefined) return;
    const block = blockIn(body, blockId);
    if (block === undefined) return;
    if (!selected.includes(id)) select([id]);
    editing = blockId;
    const signal = textSignal(blockId, block.display.length, block.display.length);
    view.inspect(signal.key, signal.selection);
  };

  const startTyping = (element: SlideElement, typed: string) => {
    if (body === undefined) return;
    const block = textOf(element);
    if (block === undefined) {
      const made = emptyText(body.styles.defaultKey, typed);
      apply(withSet(body, `${element.id}/content/block`, made).ops);
      editing = made.id;
      const signal = textSignal(made.id, typed.length, typed.length);
      view.inspect(signal.key, signal.selection);
      return;
    }
    const at = block.display.length;
    if (typed !== "") apply(replaced(block, at, at, typed));
    editing = block.id;
    const signal = textSignal(block.id, at + typed.length, at + typed.length);
    view.inspect(signal.key, signal.selection);
  };

  const exit = () => {
    if (editing === undefined) return;
    const holder = holderOf(editing);
    editing = undefined;
    if (holder !== undefined) select([holder]);
    else if (selected.length > 0) select(selected);
    else clear();
  };

  const edited = (change: SurfaceTextEdit) => {
    if (body === undefined) return;
    const block = blockIn(body, change.blockId);
    if (block === undefined) return;
    apply(replaced(block, change.from, change.to, change.insert));
  };

  const caret = (blockId: string, from: number, to: number) => {
    if (editing !== blockId) return;
    const signal = textSignal(blockId, from, to);
    if (sameSelection(view.selection, signal.selection) && view.inspected === signal.key) return;
    view.inspect(signal.key, signal.selection);
  };

  const badge = (id: string) => {
    if (slide === undefined) return;
    const signal = threadsSignal(id === "" ? slide.id : id);
    if (id !== "") select([id]);
    view.inspect(signal.key, signal.selection);
  };

  let pointed: SurfacePoint | undefined;
  let onSlide = false;
  let insertAt = $state<SurfacePoint | undefined>(undefined);

  const pointedAt = (at: SurfacePoint) => {
    pointed = at;
    onSlide = true;
  };

  const armMenu = () => {
    insertAt = onSlide ? pointed : undefined;
    onSlide = false;
  };

  const put = (kind: PlacedKind, at: SurfacePoint | undefined) => {
    if (body === undefined || slide === undefined) return;
    const element = makeElement(kind, body, frameFor(kind, at));
    const edit = withInsertedElements(body, slide.id, [element]);
    if (edit.ops.length === 0) return;
    editing = undefined;
    apply(edit.ops);
    const signal = elementsSignal([element]);
    if (signal) view.inspect(signal.key, signal.selection);
  };

  const insert = (entry: InsertEntry) => {
    if (!entry.ready) return;
    put(entry.kind as PlacedKind, insertAt);
  };

  const place = (at: SurfacePoint) => {
    const kind = placing.kind;
    arm(undefined);
    if (kind !== undefined) put(kind, at);
  };

  $effect(() => () => arm(undefined));

  const snap = (frame: SurfaceFrame, id: string, alt: boolean): { frame: SurfaceFrame; guides: SurfaceGuide[] } => {
    if (alt || slide === undefined) return { frame, guides: [] };
    const others = placedOn(slide)
      .filter((placed) => placed.depth === 0 && placed.element.id !== id && !selected.includes(placed.element.id))
      .map((placed) => placed.frame);
    return snapped(frame, targetsOf(others), SNAP);
  };

  const keydown = (event: KeyboardEvent) => {
    if (body === undefined || slide === undefined || event.defaultPrevented) return;
    const mod = event.metaKey || event.ctrlKey;

    if (editing !== undefined) {
      const range = rangeOf(view.selection);
      if (mod && range && ["b", "i", "u"].includes(event.key.toLowerCase())) {
        const block = blockIn(body, range.blockId);
        if (!block) return;
        event.preventDefault();
        const style = event.key.toLowerCase() === "b" ? "bold" : event.key.toLowerCase() === "i" ? "italic" : "underline";
        apply(toggledMark(block, range.from, range.to, style));
      }
      return;
    }

    if (event.target instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) || event.target.isContentEditable)) return;

    if (event.key === "Escape") {
      if (placing.kind !== undefined) arm(undefined);
      else if (cells.length > 0) select(selected);
      else clear();
      return;
    }
    if (selected.length === 0) return;

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      apply(withoutElements(body, selected).ops);
      clear();
      return;
    }
    if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      const stepX = (event.shiftKey ? 10 : 1) / units.width;
      const stepY = (event.shiftKey ? 10 : 1) / units.height;
      const dx = event.key === "ArrowLeft" ? -stepX : event.key === "ArrowRight" ? stepX : 0;
      const dy = event.key === "ArrowUp" ? -stepY : event.key === "ArrowDown" ? stepY : 0;
      const moves = placedOn(slide)
        .filter((placed) => selected.includes(placed.element.id))
        .map((placed) => ({ id: placed.element.id, frame: nudged(placed.frame, dx, dy) }));
      frames(moves);
      return;
    }
    if (mod && event.key.toLowerCase() === "g") {
      event.preventDefault();
      if (event.shiftKey) {
        const edit = withUngrouped(body, selected[0]);
        apply(edit.ops);
        clear();
      } else {
        const before = slide;
        const edit = withGrouped(body, selected);
        const made = edit.body.slides.find((held) => held.id === before.id)?.elements.find((element) => element.content.type === "group" && !before.elements.some((was) => was.id === element.id));
        apply(edit.ops);
        if (made) select([made.id]);
      }
      return;
    }
    if (mod && event.key.toLowerCase() === "d") {
      event.preventDefault();
      const before = slide;
      const edit = withDuplicatedElements(body, selected);
      const fresh = edit.body.slides.find((held) => held.id === before.id)?.elements.filter((element) => !before.elements.some((was) => was.id === element.id)).map((element) => element.id) ?? [];
      apply(edit.ops);
      if (fresh.length > 0) select(fresh);
      return;
    }
    if (mod || event.altKey || selected.length !== 1 || cells.length > 0) return;

    const element = elementIn(body, selected[0]);
    if (element === undefined || (element.content.type !== "text" && element.content.type !== "shape")) return;
    if (event.key === "Enter") {
      event.preventDefault();
      const block = textOf(element);
      if (block) enter(element.id, block.id);
      else startTyping(element, "");
      return;
    }
    if (event.key.length === 1) {
      event.preventDefault();
      startTyping(element, event.key);
    }
  };

  const focusPoint = (): SurfacePoint => {
    if (slide !== undefined && selected.length > 0) {
      const held = boundsOf(placedOn(slide).filter((placed) => selected.includes(placed.element.id)).map((placed) => placed.frame));
      return { x: held.x + held.width / 2, y: held.y + held.height / 2 };
    }
    const element = surface;
    if (element === undefined || size.width === 0) return { x: 0.5, y: 0.5 };
    const x = (element.scrollLeft + element.clientWidth / 2 - GUTTER) / size.width;
    const y = (element.scrollTop + element.clientHeight / 2 - GUTTER) / size.height;
    return { x: Math.min(Math.max(x, 0), 1), y: Math.min(Math.max(y, 0), 1) };
  };

  const zoomTo = (wanted: number) => {
    if (geometry === undefined) return;
    const focus = focusPoint();
    view.setZoom(clampZoom(wanted, geometry));
    void tick().then(() => {
      const element = surface;
      if (element === undefined) return;
      element.scrollTo({
        left: Math.max(0, GUTTER + focus.x * size.width - element.clientWidth / 2),
        top: Math.max(0, GUTTER + focus.y * size.height - element.clientHeight / 2)
      });
    });
  };

  const pinch = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoomTo((view.zoom ?? 100) - (event.deltaY / WHEEL_NOTCH) * PERCENT_PER_NOTCH);
  };

  const zoomBy = (direction: 1 | -1) => {
    if (geometry === undefined) return;
    zoomTo((view.zoom ?? 100) + direction * geometry.zoomStep);
  };

  const step = (direction: 1 | -1) => {
    const next = body?.slides[index + direction];
    if (next) show(next.id);
  };

  let shownSlide: string | undefined;

  $effect(() => {
    const id = slide?.id;
    if (id === shownSlide) return;
    shownSlide = id;
    editing = undefined;
  });

  $effect(() => {
    const range = rangeOf(view.selection);
    if (range === undefined || body === undefined || slide === undefined) return;
    if (editing === range.blockId) return;
    if (holderOf(range.blockId) !== undefined) editing = range.blockId;
  });

  const armedLabel = $derived(INSERT_GROUPS.flatMap((group) => group.entries).find((entry) => entry.kind === placing.kind)?.label);
</script>

<svelte:window onkeydown={keydown} />

<div class="deck">
  <header class="area-title bg-surface-panel border-border-subtle border-b">
    <h1 class="text-body-sm text-ink-primary m-0 truncate font-medium">{deckTitle ?? "Loading deck..."}</h1>
  </header>

  <ContextMenu.Root>
    <ContextMenu.Trigger>
      {#snippet child({ props })}
        <div
          {...props}
          bind:this={surface}
          class="area-canvas bg-surface-pasteboard"
          onwheel={pinch}
        >
          {#if scene && size.width > 0}
            <div
              bind:this={board}
              class="pasteboard"
              class:is-placing={placing.kind !== undefined}
              style="padding: {GUTTER}px"
              role="presentation"
              oncontextmenu={armMenu}
            >
              <SlideSurface
                {scene}
                width={size.width}
                height={size.height}
                {selected}
                {cells}
                {editing}
                {badges}
                {board}
                placing={placing.kind !== undefined}
                onselect={(ids) => select(ids)}
                onselectcells={pickCells}
                onclear={clear}
                onplace={place}
                onframes={(moves) => frames(moves)}
                onrotate={(id, rotation) => rotate(id, rotation)}
                online={(id, from, to) => line(id, from, to)}
                ongrow={grow}
                onenter={enter}
                onexit={exit}
                onedit={edited}
                oncaret={caret}
                onbadge={badge}
                oncontext={pointedAt}
                {snap}
              />
            </div>
          {/if}
        </div>
      {/snippet}
    </ContextMenu.Trigger>

    <ContextMenu.Content class="w-52">
      <ContextMenu.Label class="text-caption text-ink-muted px-1.5 py-1 font-normal">
        Add to slide {index + 1}{insertAt === undefined ? "" : ", here"}
      </ContextMenu.Label>
      {#each INSERT_GROUPS as group (group.title)}
        {#if group.nested}
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger>
              {@const Glyph = ICON[group.entries[0].kind]}
              <Glyph size={14} aria-hidden="true" />
              {group.title}
            </ContextMenu.SubTrigger>
            <ContextMenu.SubContent class="w-40">
              {#each group.entries as entry (entry.kind)}
                {@const Glyph = ICON[entry.kind]}
                <ContextMenu.Item disabled={!entry.ready} onSelect={() => insert(entry)}>
                  <Glyph size={14} aria-hidden="true" />
                  {entry.label}
                </ContextMenu.Item>
              {/each}
            </ContextMenu.SubContent>
          </ContextMenu.Sub>
        {:else}
          {#each group.entries as entry (entry.kind)}
            {@const Glyph = ICON[entry.kind]}
            <ContextMenu.Item
              disabled={!entry.ready}
              title={entry.ready ? undefined : entry.note}
              onSelect={() => insert(entry)}
            >
              <Glyph size={14} aria-hidden="true" />
              {entry.label}
            </ContextMenu.Item>
          {/each}
        {/if}
      {/each}
    </ContextMenu.Content>
  </ContextMenu.Root>

  <div class="area-strip bg-surface-panel border-border-subtle flex items-center gap-1 border-t">
    {#if body && slide}
      <Button variant="outline" size="xs" disabled={index === 0} onclick={() => step(-1)}>
        <ChevronLeft aria-hidden="true" />Previous
      </Button>
      <Button variant="outline" size="xs" disabled={index >= body.slides.length - 1} onclick={() => step(1)}>
        Next<ChevronRight aria-hidden="true" />
      </Button>
      <Button
        variant="outline"
        size="xs"
        class="ms-1"
        onclick={() => {
          const signal = notesSignal(slide.id);
          view.inspect(signal.key, signal.selection);
        }}
      >
        <StickyNote aria-hidden="true" />Notes
      </Button>
      {#if armedLabel}
        <span class="text-caption text-active-text ms-3">Click on the slide to place the {armedLabel.toLowerCase()} · Esc cancels</span>
      {/if}

      <span class="ms-auto flex items-center gap-1">
        <Button variant="ghost" size="icon-xs" aria-label="Zoom out" onclick={() => zoomBy(-1)}><Minus aria-hidden="true" /></Button>
        <button
          type="button"
          class="text-caption text-ink-secondary hover:text-ink-primary w-12 rounded-control tabular-nums"
          title="Back to fit"
          onclick={() => zoomTo(100)}
        >
          {percent(view.zoom)}
        </button>
        <Button variant="ghost" size="icon-xs" aria-label="Zoom in" onclick={() => zoomBy(1)}><Plus aria-hidden="true" /></Button>
        <span class="text-caption text-ink-muted ms-2">· {SYNC_LABEL[runtime?.sync ?? "loading"]}</span>
      </span>
    {:else}
      <span class="text-caption text-ink-muted ms-auto">
        {runtime?.sync === "error" ? "This deck could not be read." : "Reading this deck..."}
      </span>
    {/if}
  </div>
</div>

<style>
  .deck {
    display: grid;
    height: 100%;
    min-height: 0;
    grid-template-rows: auto 1fr auto;
    grid-template-columns: 1fr;
    grid-template-areas:
      "title"
      "canvas"
      "strip";
  }

  .area-title {
    grid-area: title;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 4);
  }

  .area-canvas {
    grid-area: canvas;
    min-height: 0;
    overflow: auto;
  }

  .area-strip {
    grid-area: strip;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
  }

  .pasteboard {
    display: flex;
    width: max-content;
    min-width: 100%;
    min-height: 100%;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
  }

  .pasteboard.is-placing {
    cursor: crosshair;
  }
</style>

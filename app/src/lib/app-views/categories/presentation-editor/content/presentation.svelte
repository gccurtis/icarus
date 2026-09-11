<script lang="ts">
  import type { Component } from "svelte";
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
    type SurfacePrompt
  } from "$authored-components/slide-surface";
  import { Button } from "$vendored-components/button";
  import * as ContextMenu from "$vendored-components/context-menu";
  import { createPresentationState } from "$app-views/categories/presentation-editor/content/presentation.state.svelte";
  import { commentsQuery, threadsIn } from "$app-views/categories/presentation-editor/procedures/comments";
  import type { PresentationActionContext } from "$app-views/categories/presentation-editor/procedures/presentation-action-context";
  import { createPresentationGeometryActions } from "$app-views/categories/presentation-editor/procedures/presentation-geometry-actions";
  import { createPresentationInsertActions } from "$app-views/categories/presentation-editor/procedures/presentation-insert-actions";
  import { createPresentationKeyboardAction } from "$app-views/categories/presentation-editor/procedures/presentation-keyboard-actions";
  import { placedOn } from "$app-views/categories/presentation-editor/procedures/presentation-placement";
  import { holderOn } from "$app-views/categories/presentation-editor/procedures/presentation-reading";
  import { createPresentationSelectionActions } from "$app-views/categories/presentation-editor/procedures/presentation-selection-actions";
  import { slideIndexOf } from "$app-views/categories/presentation-editor/procedures/presentation-slides";
  import { createPresentationZoomActions } from "$app-views/categories/presentation-editor/procedures/presentation-zoom-actions";
  import { mountsPresentationSurface } from "$app-views/categories/presentation-editor/procedures/effects/mounts-presentation-surface.svelte";
  import { INSERT_GROUPS } from "$app-views/categories/presentation-editor/procedures/inserting";
  import {
    resourceName,
    resourceIndex
  } from "$app-views/categories/presentation-editor/procedures/resource-index";
  import { sceneOf } from "$app-views/categories/presentation-editor/procedures/scene";
  import { notesSignal, rangeOf, selectedCells, selectedIds } from "$app-views/categories/presentation-editor/procedures/selecting";
  import { drawn, fitted, percent, slideUnits } from "$app-views/categories/presentation-editor/procedures/stage";
  import { resourceTemplate } from "$app-views/categories/presentation-editor/procedures/template-resources";
  import { workspaceState, type SyncState } from "$model/client/workspace-state";

  const GUTTER = 24;

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
  const held = createPresentationState();
  const presentationId = view.active.resourceId;
  const resources = resourceIndex();
  const template = presentationId === undefined ? undefined : resourceTemplate(presentationId);
  const runtime = presentationId === undefined ? undefined : view.presentationRuntime(presentationId);

  const presentationTitle = $derived.by(() => {
    if (presentationId === undefined) return undefined;
    return resourceName(resources, presentationId, template?.current);
  });
  const body = $derived(runtime?.body);
  const index = $derived(
    body === undefined ? 0 : slideIndexOf(body, view.active.focus ?? undefined)
  );
  const slide = $derived(body?.slides[index]);
  const geometry = $derived(runtime?.stage);
  const units = $derived(
    body === undefined || geometry === undefined
      ? { width: 1280, height: 720 }
      : slideUnits(body.aspectRatio, geometry)
  );
  const scene = $derived(body === undefined ? undefined : sceneOf(body, slide, units));
  const fit = $derived(
    body === undefined
      ? { width: 0, height: 0 }
      : fitted(held.available, body.aspectRatio, GUTTER)
  );
  const size = $derived(drawn(fit, view.zoom));

  const selected = $derived.by(() => {
    if (slide === undefined) return [] as string[];
    const onSlide = new Set(placedOn(slide).map((placed) => placed.element.id));
    const chosen = selectedIds(view.selection).filter((id) => onSlide.has(id));
    if (chosen.length === 0 && held.editing !== undefined) {
      const holder = holderOn(slide, held.editing)?.id;
      if (holder !== undefined) return [holder];
    }
    return chosen;
  });
  const cells = $derived(selectedCells(view.selection));
  const textSelection = $derived(rangeOf(view.selection));

  const comments = commentsQuery();
  const threads = $derived.by(() => {
    if (presentationId === undefined) return [];
    return threadsIn(comments).filter(
      (row) => row.target.kind === "presentation" && row.target.id === presentationId && row.resolution === undefined
    );
  });
  const badges = $derived.by((): SurfaceBadge[] => {
    if (slide === undefined) return [];
    const counts = new Map<string, number>();
    for (const thread of threads) {
      const within = thread.within;
      if (within?.kind === "element" && within.elementId) {
        counts.set(within.elementId, (counts.get(within.elementId) ?? 0) + 1);
      } else if (within?.kind === "slide" && within.slideId === slide.id) {
        counts.set("", (counts.get("") ?? 0) + 1);
      }
    }
    return [...counts].map(([id, count]) => ({ id, count }));
  });
  const promptMarkers = $derived.by((): SurfacePrompt[] =>
    slide === undefined
      ? []
      : placedOn(slide).flatMap(({ element }) =>
          element.content.type === "prompt" ? [{ id: element.id }] : []
        )
  );

  const actionContext = {
    view,
    runtime,
    held,
    presentationId,
    get body() { return body; },
    get slide() { return slide; },
    get selected() { return selected; },
    get cells() { return cells; },
    get units() { return units; },
    get size() { return size; },
    get geometry() { return geometry; },
    get index() { return index; }
  } satisfies PresentationActionContext;

  const selectionActions = createPresentationSelectionActions(actionContext);
  const geometryActions = createPresentationGeometryActions(actionContext, selectionActions);
  const insertActions = createPresentationInsertActions(actionContext, selectionActions);
  const zoomActions = createPresentationZoomActions(actionContext, selectionActions);
  const keydown = createPresentationKeyboardAction(actionContext, selectionActions, geometryActions);
  mountsPresentationSurface(actionContext);
</script>


<svelte:window onkeydown={keydown} />

<div class="presentation">
  <header class="area-title bg-surface-panel border-border-subtle border-b">
    <h1 class="text-body-sm text-ink-primary m-0 truncate font-medium">{presentationTitle ?? "Loading presentation..."}</h1>
  </header>

  <ContextMenu.Root>
    <ContextMenu.Trigger>
      {#snippet child({ props })}
        <div
          {...props}
          bind:this={held.surface}
          class="area-canvas bg-surface-pasteboard"
          onwheel={zoomActions.pinch}
        >
          {#if scene && size.width > 0}
            <div
              bind:this={held.board}
              class="pasteboard"
              style="padding: {GUTTER}px"
              role="presentation"
              oncontextmenu={insertActions.armMenu}
            >
              <SlideSurface
                {scene}
                width={size.width}
                height={size.height}
                {selected}
                {cells}
                editing={held.editing}
                {textSelection}
                {badges}
                prompts={promptMarkers}
                board={held.board}
                onselect={selectionActions.select}
                onselectcells={selectionActions.pickCells}
                onclear={selectionActions.clear}
                onframes={geometryActions.frames}
                onrotate={geometryActions.rotate}
                online={geometryActions.line}
                ongrow={geometryActions.grow}
                onenter={selectionActions.enter}
                onexit={selectionActions.exit}
                onedit={selectionActions.edited}
                oncaret={selectionActions.caret}
                onbadge={selectionActions.badge}
                onprompt={selectionActions.prompt}
                oncontext={insertActions.pointedAt}
                snap={geometryActions.snap}
              />
            </div>
          {/if}
        </div>
      {/snippet}
    </ContextMenu.Trigger>

    <ContextMenu.Content class="w-52">
      <ContextMenu.Label class="text-caption text-ink-muted px-1.5 py-1 font-normal">
        Add to slide {index + 1}{held.insertAt === undefined ? "" : ", here"}
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
                <ContextMenu.Item disabled={!entry.ready} onSelect={() => insertActions.insert(entry)}>
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
              onSelect={() => insertActions.insert(entry)}
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
      <Button variant="outline" size="xs" disabled={index === 0} onclick={() => zoomActions.step(-1)}>
        <ChevronLeft aria-hidden="true" />Previous
      </Button>
      <Button variant="outline" size="xs" disabled={index >= body.slides.length - 1} onclick={() => zoomActions.step(1)}>
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
      <span class="ms-auto flex items-center gap-1">
        <Button variant="ghost" size="icon-xs" aria-label="Zoom out" onclick={() => zoomActions.zoomBy(-1)}><Minus aria-hidden="true" /></Button>
        <button
          type="button"
          class="text-caption text-ink-secondary hover:text-ink-primary w-12 rounded-control tabular-nums"
          title="Back to fit"
          onclick={() => zoomActions.zoomTo(100)}
        >
          {percent(view.zoom)}
        </button>
        <Button variant="ghost" size="icon-xs" aria-label="Zoom in" onclick={() => zoomActions.zoomBy(1)}><Plus aria-hidden="true" /></Button>
        <span class="text-caption text-ink-muted ms-2">· {SYNC_LABEL[runtime?.sync ?? "loading"]}</span>
      </span>
    {:else}
      <span class="text-caption text-ink-muted ms-auto">
        {runtime?.sync === "error" ? "This presentation could not be read." : "Reading this presentation..."}
      </span>
    {/if}
  </div>
</div>

<style>
  .presentation {
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
    scrollbar-color: transparent transparent;
    scrollbar-width: thin;
  }

  .area-canvas:hover {
    scrollbar-color: color-mix(in srgb, var(--token-border-strong) 55%, transparent) transparent;
  }

  .area-canvas::-webkit-scrollbar {
    width: calc(var(--token-spacing-unit) * 1.5);
    height: calc(var(--token-spacing-unit) * 1.5);
  }

  .area-canvas::-webkit-scrollbar-thumb {
    border-radius: var(--token-radius-control);
    background-color: transparent;
    transition: background-color var(--token-motion-small) var(--token-ease-standard);
  }

  .area-canvas:hover::-webkit-scrollbar-thumb {
    background-color: color-mix(in srgb, var(--token-border-strong) 55%, transparent);
  }

  .area-canvas::-webkit-scrollbar-track,
  .area-canvas::-webkit-scrollbar-corner {
    background: transparent;
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

</style>

# src/lib/features/stages/slides/SlideListPanel.svelte — breakdown

Companion to [SlideListPanel.svelte](SlideListPanel.svelte). The slide-list context rail: a
New/Delete/AI toolbar, a drag-reorderable list of live slide thumbnails, and a right-click
context menu (Duplicate/Delete). Reads the deck store and drives its slide mutators.

## Script — drag, menu state, and handlers

### Imports, local drag/context-menu state, and their event handlers

```svelte
<script lang="ts">
  import { Button } from '$lib/components';
  import { cn } from '$lib/utils';
  import {
    deck,
    activeSlideIndex,
    selectSlide,
    addSlide,
    deleteSlide,
    reorderSlides,
    duplicateSlide
  } from '$systems/slides';

  let dragIndex = $state<number | null>(null);
  let dragOverIndex = $state<number | null>(null);
  let menuIndex = $state<number | null>(null);
  let menuX = $state(0);
  let menuY = $state(0);

  function onDragStart(e: DragEvent, i: number) {
    dragIndex = i;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function onDragOver(e: DragEvent, i: number) {
    e.preventDefault();
    dragOverIndex = i;
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  }

  function onDrop(i: number) {
    if (dragIndex !== null && dragIndex !== i) {
      reorderSlides(dragIndex, i);
    }
    dragIndex = null;
    dragOverIndex = null;
  }

  function onDragEnd() {
    dragIndex = null;
    dragOverIndex = null;
  }

  function onContextMenu(e: MouseEvent, i: number) {
    e.preventDefault();
    menuIndex = i;
    menuX = e.clientX;
    menuY = e.clientY;
  }

  function closeMenu() {
    menuIndex = null;
  }

  function onMenuKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') closeMenu();
  }
</script>


```

HTML5 drag-and-drop state (`dragIndex`/`dragOverIndex`) drives reordering via `reorderSlides`
on drop; the context-menu state (`menuIndex` + `menuX`/`menuY`) positions a right-click menu.
Escape closes the menu. All slide operations come from the `$systems/slides` store.

## Toolbar

### New / Delete / AI actions over the deck

```svelte
<div class="space-y-1.5 px-1 py-1.5">
  <div class="border-b border-border px-0.5 pb-1.5">
    <div class="flex gap-0.5">
      <Button variant="plain" size="sm" class="h-6 flex-1 px-1.5 text-xs" onclick={() => { addSlide(); }}>New</Button>
      <Button variant="danger-secondary" size="sm" class="h-6 flex-1 px-1.5 text-xs" onclick={() => { deleteSlide($activeSlideIndex); }}>Delete</Button>
      <Button variant="intel-secondary" size="sm" class="h-6 px-1.5 text-xs" onclick={() => {}}>AI</Button>
    </div>
  </div>

```

Three compact buttons using the newer `Button` variants (`plain`, `danger-secondary`,
`intel-secondary`): New appends a slide, Delete removes the active one, AI is a placeholder
(no handler yet).

## Slide thumbnails

### A draggable, selectable list rendering each slide's objects as a scaled preview

```svelte
  {#if $deck}
    <ol class="space-y-1">
      {#each $deck.slides as s, i (s.id)}
        <li
          draggable="true"
          ondragstart={(e) => onDragStart(e, i)}
          ondragover={(e) => onDragOver(e, i)}
          ondrop={() => onDrop(i)}
          ondragend={onDragEnd}
          oncontextmenu={(e) => onContextMenu(e, i)}
          class={cn(
             'dur-micro relative flex items-start gap-1 transition-opacity',
            dragIndex === i ? 'opacity-40' : ''
          )}
        >
          <span class="shrink-0 pt-0.5 text-xs tabular-nums text-muted">{i + 1}</span>
          <button
            type="button"
            class={cn(
              'dur-micro min-w-0 flex-1 rounded-[2px] border text-left text-caption transition-colors',
              $activeSlideIndex === i
                ? 'border-action/40'
                : dragOverIndex === i && dragIndex !== i
                  ? 'border-action/20'
                  : 'border-transparent hover:border-border/60'
            )}
            onclick={(e) => { e.stopPropagation(); selectSlide(i); }}
          >
            <div class="">
              <div class="relative overflow-hidden border border-border/40 bg-white" style="aspect-ratio: {$deck.canvas.width / $deck.canvas.height}">
              {#each s.objects as obj (obj.id)}
                {#if obj.kind === 'text' && obj.content}
                  <div
                    class="pointer-events-none absolute overflow-hidden leading-tight text-secondary"
                    style="left: {obj.frame.x / $deck.canvas.width * 100}%; top: {obj.frame.y / $deck.canvas.height * 100}%; width: {obj.frame.width / $deck.canvas.width * 100}%; height: {obj.frame.height / $deck.canvas.height * 100}%; font-size: {Math.max(6, (obj.style?.fontSize ?? 20) * 0.12)}px; text-align: {obj.style?.alignment ?? 'left'}; color: {obj.style?.color ? obj.style.color + '99' : '#58636d'}"
                  >
                    {obj.content}
                  </div>
                {:else if obj.kind === 'shape'}
                  <div
                    class="pointer-events-none absolute rounded-[2px]"
                    style="left: {obj.frame.x / $deck.canvas.width * 100}%; top: {obj.frame.y / $deck.canvas.height * 100}%; width: {obj.frame.width / $deck.canvas.width * 100}%; height: {obj.frame.height / $deck.canvas.height * 100}%; background: {obj.style?.fill ?? '#e0e0e0'}; border: 1px solid {obj.style?.stroke ?? '#cccccc'}"
                  ></div>
                {/if}
              {/each}
              </div>
            </div>
          </button>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="text-caption text-muted">No slides yet.</p>
  {/if}
</div>

```

Each slide is a numbered, draggable row whose thumbnail is a live miniature: a box at the deck
aspect ratio with every object positioned by percentage of the canvas, text scaled down and
shapes drawn with their fill/stroke. The active slide is ringed; drag-over shows a lighter
border; clicking selects the slide (`selectSlide`). Empty deck shows a note.

## Context menu

### Right-click Duplicate / Delete

```svelte
<svelte:window onkeydown={onMenuKeydown} />

{#if menuIndex !== null}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-40" onclick={closeMenu} oncontextmenu={(e) => { e.preventDefault(); closeMenu(); }}></div>
  <div
    role="menu"
    class="surface-elevated fixed z-50 min-w-36 p-1 text-body-sm"
    style="left: {menuX}px; top: {menuY}px"
  >
    <button
      role="menuitem"
      onclick={() => { duplicateSlide(menuIndex!); closeMenu(); }}
      class="dur-micro block w-full rounded-control px-3 py-1.5 text-left text-secondary transition-colors hover:bg-panel hover:text-primary"
    >
      Duplicate
    </button>
    <button
      role="menuitem"
      onclick={() => { deleteSlide(menuIndex!); closeMenu(); }}
      class="dur-micro block w-full rounded-control px-3 py-1.5 text-left text-danger transition-colors hover:bg-panel"
    >
      Delete
    </button>
  </div>
{/if}
```

A window keydown listener closes the menu on Escape. When open, a full-screen backdrop
captures the next click/right-click to dismiss, and a positioned menu offers Duplicate
(`duplicateSlide`) and Delete (`deleteSlide`) for the right-clicked slide.

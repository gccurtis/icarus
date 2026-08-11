# src/lib/features/stages/slides/SlideActionsPanel.svelte — breakdown

Companion to [SlideActionsPanel.svelte](SlideActionsPanel.svelte). The slide inspector's
"General" section: quick actions to add objects to the current slide and to set the slide
background. Reads the deck store and calls its mutators directly.

## Imports and current slide

### Deck store, object/background mutators, and the shared color palette

```svelte
<script lang="ts">
  import { Type, Square } from '@lucide/svelte';
  import { Button } from '$lib/components';
  import { inspectorColorPalette } from '$lib/features/shared/inspector-options';
  import { cn } from '$lib/utils';
  import {
    deck,
    activeSlideIndex,
    addSlideObject,
    setSlideBackground
  } from '$systems/slides';

  const currentSlide = $derived($deck?.slides[$activeSlideIndex] ?? null);
</script>

```

Pulls the add-text/add-shape icons, the `Button`, the shared inspector color palette (reused
from the document inspector), and the slide store's `addSlideObject` / `setSlideBackground`
mutators. `currentSlide` is the slide at the active index (or null).

## Add-to-slide actions

### Add a text box or a rectangle to the current slide

```svelte
<div class="space-y-4">
  <div class="space-y-3">
    <p class="text-caption text-muted">Add to slide</p>

    {#if $deck}
      <div class="space-y-1.5">
        <Button
          variant="secondary"
          size="sm"
          class="w-full"
          disabled={!currentSlide}
          onclick={() => {
            if (!currentSlide) return;
            addSlideObject(currentSlide.id, {
              id: `obj_${Math.random().toString(36).slice(2, 8)}`,
              kind: 'text',
              frame: { x: 120, y: 200, width: 720, height: 100 },
              content: 'Type here',
              style: { fontSize: 24, alignment: 'center' }
            });
          }}
        >
          <Type class="size-4" />
          Add text box
        </Button>

        <Button
          variant="secondary"
          size="sm"
          class="w-full"
          disabled={!currentSlide}
          onclick={() => {
            if (!currentSlide) return;
            addSlideObject(currentSlide.id, {
              id: `obj_${Math.random().toString(36).slice(2, 8)}`,
              kind: 'shape',
              frame: { x: 280, y: 180, width: 400, height: 200 },
              style: { fill: '#f0f0f0', stroke: '#d0d0d0', strokeWidth: 1 }
            });
          }}
        >
          <Square class="size-4" />
          Add rectangle
        </Button>
      </div>
    {:else}
      <p class="text-caption text-muted">No slide selected.</p>
    {/if}
  </div>

```

Two buttons append a seeded object to the current slide via `addSlideObject` — a centered text
box or a light-filled rectangle, each at a sensible default frame with a fresh id. Both are
disabled without a current slide; when no deck is loaded the section shows an empty note.

## Background swatches

### Set the slide background from the shared palette

```svelte
  {#if currentSlide}
    <div>
      <p class="mb-1.5 text-caption text-muted">Background</p>
      <div class="flex flex-wrap gap-1.5">
        {#each inspectorColorPalette as swatch (swatch)}
          <button
            type="button"
            aria-label={`Background ${swatch}`}
            onclick={() => setSlideBackground(currentSlide.id, swatch)}
            class={cn(
              'size-6 rounded-full border transition-shadow',
              (currentSlide.backgroundColor ?? '#ffffff') === swatch
                ? 'border-primary ring-2 ring-action/40'
                : 'border-transparent hover:ring-2 hover:ring-border'
            )}
            style="background-color: {swatch}"
          ></button>
        {/each}
      </div>
    </div>
  {/if}
</div>
```

A swatch grid (the shared `inspectorColorPalette`) sets the slide's `backgroundColor` via
`setSlideBackground`; the currently-selected background (default white) is ringed. Only shown
when a slide is active.

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

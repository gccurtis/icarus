<script lang="ts">
  import { Bold, Italic, Underline } from '@lucide/svelte';
  import { deck, activeSlideIndex, activeObjectId, updateSlideObject } from '$systems/slides';
  import { inspectorFontOptions, inspectorColorPalette } from '$lib/features/shared/inspector-options';
  import { Select, NumberField, IconButton } from '$lib/components';
  import { cn } from '$lib/utils';

  const activeSlide = $derived($deck?.slides[$activeSlideIndex] ?? null);

  const selectedObject = $derived.by(() => {
    if (!activeSlide || !$activeObjectId) return null;
    return activeSlide.objects.find((o) => o.id === $activeObjectId && o.kind === 'text') ?? null;
  });

  function updateStyle(patch: Record<string, unknown>): void {
    const obj = selectedObject;
    if (!obj) return;
    updateSlideObject(activeSlide!.id, obj.id, { style: { ...obj.style, ...patch } });
  }
</script>

{#if selectedObject}
  <div class="space-y-4">
    <!-- Font family -->
    <Select
      value={selectedObject.style?.fontFamily ?? 'plex-sans'}
      options={inspectorFontOptions}
      size="sm"
      onchange={(e: Event) => {
        const target = e.currentTarget as HTMLSelectElement;
        updateStyle({ fontFamily: target.value });
      }}
    />

    <!-- Font size -->
    <div class="flex items-center gap-3">
      <NumberField
        ariaLabel="Font size"
        class="w-16"
        value={selectedObject.style?.fontSize ?? 24}
        min={8}
        max={200}
        step={1}
        suffix="px"
        onchange={(v) => updateStyle({ fontSize: v })}
      />
    </div>

    <!-- Bold / Italic / Underline toggles -->
    <div class="flex items-center gap-1">
      <IconButton
        label="Bold"
        size="sm"
        variant={selectedObject.style?.bold ? 'primary' : 'ghost'}
        onclick={() => updateStyle({ bold: !selectedObject.style?.bold })}
      >
        <Bold class="size-4" />
      </IconButton>
      <IconButton
        label="Italic"
        size="sm"
        variant={selectedObject.style?.italic ? 'primary' : 'ghost'}
        onclick={() => updateStyle({ italic: !selectedObject.style?.italic })}
      >
        <Italic class="size-4" />
      </IconButton>
      <IconButton
        label="Underline"
        size="sm"
        variant={selectedObject.style?.underline ? 'primary' : 'ghost'}
        onclick={() => updateStyle({ underline: !selectedObject.style?.underline })}
      >
        <Underline class="size-4" />
      </IconButton>
    </div>

    <!-- Text color -->
    <div>
      <p class="mb-1.5 text-caption text-muted">Color</p>
      <div class="flex flex-wrap gap-1.5">
        {#each inspectorColorPalette as swatch (swatch)}
          <button
            type="button"
            aria-label={`Color ${swatch}`}
            onclick={() => updateStyle({ color: swatch })}
            class={cn(
              'size-6 rounded-full border transition-shadow',
              (selectedObject.style?.color ?? '#202428') === swatch
                ? 'border-primary ring-2 ring-action/40'
                : 'border-transparent hover:ring-2 hover:ring-border'
            )}
            style="background-color: {swatch}"
          ></button>
        {/each}
      </div>
    </div>
  </div>
{:else}
  <p class="text-caption text-muted">Select a text box to edit its properties.</p>
{/if}

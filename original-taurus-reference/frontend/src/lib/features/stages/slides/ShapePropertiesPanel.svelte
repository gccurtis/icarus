<script lang="ts">
  import { deck, activeSlideIndex, activeObjectId, updateSlideObject } from '$systems/slides';
  import { inspectorColorPalette } from '$lib/features/shared/inspector-options';
  import { NumberField } from '$lib/components';
  import { cn } from '$lib/utils';

  const activeSlide = $derived($deck?.slides[$activeSlideIndex] ?? null);

  const selectedObject = $derived.by(() => {
    if (!activeSlide || !$activeObjectId) return null;
    return activeSlide.objects.find((o) => o.id === $activeObjectId && o.kind === 'shape') ?? null;
  });

  function updateStyle(patch: Record<string, unknown>): void {
    const obj = selectedObject;
    if (!obj) return;
    updateSlideObject(activeSlide!.id, obj.id, { style: { ...obj.style, ...patch } });
  }
</script>

{#if selectedObject}
  <div class="space-y-4">
    <!-- Fill color -->
    <div>
      <p class="mb-1.5 text-caption text-muted">Fill</p>
      <div class="flex flex-wrap gap-1.5">
        {#each inspectorColorPalette as swatch (swatch)}
          <button
            type="button"
            aria-label={`Fill ${swatch}`}
            onclick={() => updateStyle({ fill: swatch })}
            class={cn(
              'size-6 rounded-full border transition-shadow',
              (selectedObject.style?.fill ?? '#e0e0e0') === swatch
                ? 'border-primary ring-2 ring-action/40'
                : 'border-transparent hover:ring-2 hover:ring-border'
            )}
            style="background-color: {swatch}"
          ></button>
        {/each}
      </div>
    </div>

    <!-- Stroke color -->
    <div>
      <p class="mb-1.5 text-caption text-muted">Stroke</p>
      <div class="flex flex-wrap gap-1.5">
        {#each inspectorColorPalette as swatch (swatch)}
          <button
            type="button"
            aria-label={`Stroke ${swatch}`}
            onclick={() => updateStyle({ stroke: swatch })}
            class={cn(
              'size-6 rounded-full border transition-shadow',
              (selectedObject.style?.stroke ?? '#cccccc') === swatch
                ? 'border-primary ring-2 ring-action/40'
                : 'border-transparent hover:ring-2 hover:ring-border'
            )}
            style="background-color: {swatch}"
          ></button>
        {/each}
      </div>
    </div>

    <!-- Stroke width -->
    <div class="flex items-center gap-3">
      <p class="w-20 text-caption text-muted">Stroke width</p>
      <NumberField
        ariaLabel="Stroke width"
        class="w-16"
        value={selectedObject.style?.strokeWidth ?? 1}
        min={0}
        max={20}
        step={1}
        suffix="px"
        onchange={(v) => updateStyle({ strokeWidth: v })}
      />
    </div>

    <!-- Corner radius -->
    <div class="flex items-center gap-3">
      <p class="w-20 text-caption text-muted">Corner radius</p>
      <NumberField
        ariaLabel="Corner radius"
        class="w-16"
        value={selectedObject.style?.cornerRadius ?? 4}
        min={0}
        max={200}
        step={1}
        suffix="px"
        onchange={(v) => updateStyle({ cornerRadius: v })}
      />
    </div>
  </div>
{:else}
  <p class="text-caption text-muted">Select a shape to edit its properties.</p>
{/if}

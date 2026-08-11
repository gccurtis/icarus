# src/lib/features/stages/slides/ShapePropertiesPanel.svelte — breakdown

Companion to [ShapePropertiesPanel.svelte](ShapePropertiesPanel.svelte). Inspector section displayed when a shape object is selected on the slide canvas. Provides fill color, stroke color, stroke width, and corner radius controls.

## Script — imports and derived state

### Deck store, shared palette, and the selected shape

```svelte
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

```

`selectedObject` only resolves for `kind === 'shape'` — same pattern as `TextPropertiesPanel` for text objects. The panel shows nothing when a text object is selected.

## Script — style update helper

### Merge a style patch onto the selected shape

```svelte
  function updateStyle(patch: Record<string, unknown>): void {
    const obj = selectedObject;
    if (!obj) return;
    updateSlideObject(activeSlide!.id, obj.id, { style: { ...obj.style, ...patch } });
  }
</script>

```

Same merge-then-write pattern shared with `TextPropertiesPanel`. Updates propagate through the deck store → `FabricCanvas` `$effect` re-sync.

## Markup — fill color swatches

### Palette grid writing `style.fill`

```svelte
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

```

Defaults to `#e0e0e0`, matching the `addSlideObject` default for new rectangles. Selected swatch gets an action ring with border.

## Markup — stroke color swatches

### Palette grid writing `style.stroke`

```svelte
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

```

Same swatch pattern, defaulting to `#cccccc` (the current `addSlideObject` default for `stroke`).

## Markup — stroke width

### NumberField writing `style.strokeWidth`

```svelte
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

```

Constrained 0–20. A value of 0 effectively removes the stroke (Fabric renders no stroke when width is 0).

## Markup — corner radius

### NumberField writing `style.cornerRadius`

```svelte
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
```

Defaults to 4, matching the hardcoded `rx: 4, ry: 4` that was in `FabricCanvas.svelte` before this phase. At 0 the rectangle has sharp corners; higher values produce progressively rounder rectangles. Both `rx` and `ry` use the same value for uniform corner rounding.

## Markup — fallback

### Prompt shown when no shape is selected

```svelte
{:else}
  <p class="text-caption text-muted">Select a shape to edit its properties.</p>
{/if}
```

Appears when no shape object is selected (a text object, or nothing, is active).

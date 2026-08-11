# src/lib/features/stages/slides/TextPropertiesPanel.svelte — breakdown

Companion to [TextPropertiesPanel.svelte](TextPropertiesPanel.svelte). Inspector section displayed when a text object is selected on the slide canvas. Provides font family, font size, bold/italic/underline toggles, and a text color swatch palette.

## Script — imports

### Formatting icons, deck store, shared inspector options, and UI controls

```svelte
<script lang="ts">
  import { Bold, Italic, Underline } from '@lucide/svelte';
  import { deck, activeSlideIndex, activeObjectId, updateSlideObject } from '$systems/slides';
  import { inspectorFontOptions, inspectorColorPalette } from '$lib/features/shared/inspector-options';
  import { Select, NumberField, IconButton } from '$lib/components';
  import { cn } from '$lib/utils';

```

Lucide provides the formatting toggle icons. The slide system provides the deck store and `updateSlideObject` for writing style changes. Font options and color swatches are shared from the document inspector module.

## Script — derive active slide and selected object

### Reactive active slide and the selected text object

```svelte
  const activeSlide = $derived($deck?.slides[$activeSlideIndex] ?? null);

  const selectedObject = $derived.by(() => {
    if (!activeSlide || !$activeObjectId) return null;
    return activeSlide.objects.find((o) => o.id === $activeObjectId && o.kind === 'text') ?? null;
  });

```

`activeSlide` is a reactive derivation from the deck store and the current slide index. `selectedObject` reacts to both slide changes and object selection — it only resolves when the active object is a text kind, so the panel shows nothing for shape selections (those are handled by `ShapePropertiesPanel` in Phase 3c).

## Script — style update helper

### Merge a style patch onto the selected text object

```svelte
  function updateStyle(patch: Record<string, unknown>): void {
    const obj = selectedObject;
    if (!obj) return;
    updateSlideObject(activeSlide!.id, obj.id, { style: { ...obj.style, ...patch } });
  }
</script>

```

Merges the patch into the existing style object and writes through `updateSlideObject`. The store emits a new deck, the `$effect` in `FabricCanvas.svelte` detects the slide reference change, and re-syncs the canvas — so store changes reflect on-screen immediately.

## Markup — font family Select

### Shared font dropdown writing `style.fontFamily`

```svelte
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

```

Uses the shared `inspectorFontOptions` from the document inspector system. Defaults to `plex-sans` (IBM Plex Sans) when the object has no explicit `fontFamily` set.

## Markup — font size NumberField

### Numeric point-size control writing `style.fontSize`

```svelte
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

```

Constrained between 8 and 200 with 1px steps. The `suffix="px"` provides a unit label. Defaults to 24px, matching the mock deck's title slide text.

## Markup — bold / italic / underline toggles

### Three formatting toggles flipping their style flags

```svelte
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

```

Each toggle flips its boolean style flag. Active toggles render with `variant="primary"` (filled action color); inactive toggles use `variant="ghost"` (transparent). The `onclick` handler reads the current style value to compute the inverse.

## Markup — text color swatches

### Palette grid writing `style.color`

```svelte
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
```

Each swatch is a circular `<button>` with the color as its background. The selected swatch gets a primary border and an action-colored ring; unselected swatches get a border ring on hover. Defaults to `#202428` when the object has no explicit color set.

## Markup — fallback

### Prompt shown when no text object is selected

```svelte
{:else}
  <p class="text-caption text-muted">Select a text box to edit its properties.</p>
{/if}
```

Shows a prompt when no text object is selected rather than an empty panel.

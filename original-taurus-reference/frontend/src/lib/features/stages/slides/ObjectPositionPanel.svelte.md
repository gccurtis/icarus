# src/lib/features/stages/slides/ObjectPositionPanel.svelte — breakdown

Companion to [ObjectPositionPanel.svelte](ObjectPositionPanel.svelte). Inspector section displayed whenever any object is selected on the slide canvas. Provides numeric inputs for X/Y position, width/height, rotation, and z-order reordering buttons.

## Script — imports

### Z-order icons, deck store + reorder mutators, and UI controls

```svelte
<script lang="ts">
  import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown } from '@lucide/svelte';
  import {
    deck,
    activeSlideIndex,
    activeObjectId,
    updateSlideObject,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack
  } from '$systems/slides';
  import { NumberField, IconButton } from '$lib/components';

```

Pulls the chevron icons for the z-order buttons, the deck store plus the four reorder mutators (`bringForward` / `sendBackward` / `bringToFront` / `sendToBack`), and the `NumberField` / `IconButton` controls.

## Script — derived state

### Active slide and the selected object (any kind)

```svelte
  const activeSlide = $derived($deck?.slides[$activeSlideIndex] ?? null);

  const selectedObject = $derived.by(() => {
    if (!activeSlide || !$activeObjectId) return null;
    return activeSlide.objects.find((o) => o.id === $activeObjectId) ?? null;
  });

```

Unlike `TextPropertiesPanel` and `ShapePropertiesPanel`, `selectedObject` does not filter by kind — this panel appears for every object type (text, shape, image, etc.) because position and size are universal properties.

## Script — frame update helper

### Merge a partial frame patch onto the selected object

```svelte
  function updateFrame(patch: Partial<{ x: number; y: number; width: number; height: number; rotation: number }>): void {
    const obj = selectedObject;
    if (!obj) return;
    updateSlideObject(activeSlide!.id, obj.id, { frame: { ...obj.frame, ...patch } });
  }
</script>

```

Merges the patch into the object's existing frame, preserving properties that aren't being changed. This avoids the frame-replacement problem where passing only `{ x: 100 }` would discard the current `width`, `height`, and `rotation`.

## Markup — position X / Y

### Two-column X and Y position fields

```svelte
{#if selectedObject}
  <div class="space-y-4">
    <!-- Position: X / Y -->
    <div class="grid grid-cols-2 gap-2">
      <div>
        <p class="mb-1 text-caption text-muted">X</p>
        <NumberField
          ariaLabel="X position"
          class="w-full"
          value={selectedObject.frame.x}
          step={1}
          onchange={(v) => updateFrame({ x: v })}
        />
      </div>
      <div>
        <p class="mb-1 text-caption text-muted">Y</p>
        <NumberField
          ariaLabel="Y position"
          class="w-full"
          value={selectedObject.frame.y}
          step={1}
          onchange={(v) => updateFrame({ y: v })}
        />
      </div>
    </div>

```

Both fields use step 1 with no min/max bounds, allowing free placement within the 960×540 canvas. The values sync bidirectionally: dragging an object on the Fabric canvas fires `object:modified` → `updateSlideObject` with the new frame → store emits → the derived `selectedObject.frame.x` updates → the NumberField shows the new value.

## Markup — size width / height

### Two-column width and height fields

```svelte
    <!-- Size: Width / Height -->
    <div class="grid grid-cols-2 gap-2">
      <div>
        <p class="mb-1 text-caption text-muted">Width</p>
        <NumberField
          ariaLabel="Width"
          class="w-full"
          value={selectedObject.frame.width}
          min={1}
          step={1}
          onchange={(v) => updateFrame({ width: v })}
        />
      </div>
      <div>
        <p class="mb-1 text-caption text-muted">Height</p>
        <NumberField
          ariaLabel="Height"
          class="w-full"
          value={selectedObject.frame.height}
          min={1}
          step={1}
          onchange={(v) => updateFrame({ height: v })}
        />
      </div>
    </div>

```

Two `NumberField`s with `min={1}` (an object must have positive dimensions). Same bidirectional sync as position.

## Markup — rotation

### Rotation field in degrees

```svelte
    <!-- Rotation -->
    <div>
      <p class="mb-1 text-caption text-muted">Rotation</p>
      <NumberField
        ariaLabel="Rotation"
        class="w-24"
        value={selectedObject.frame.rotation ?? 0}
        min={-360}
        max={360}
        step={1}
        suffix="°"
        onchange={(v) => updateFrame({ rotation: v })}
      />
    </div>

```

Rotation persists in `frame.rotation` on the `SlideObject`. The `FabricCanvas` `renderObject` reads `obj.frame.rotation ?? 0` and sets `angle` on the Fabric object. The `onObjectModified` handler extracts `obj.angle` and writes it back to the store so rotations applied via the Fabric rotate handle also persist.

## Markup — z-order buttons

### Bring-to-front / forward / backward / send-to-back controls

```svelte
    <!-- Z-order -->
    <div>
      <p class="mb-1.5 text-caption text-muted">Order</p>
      <div class="flex items-center gap-1">
        <IconButton
          label="Bring to front"
          size="sm"
          onclick={() => bringToFront(activeSlide!.id, selectedObject.id)}
        >
          <ChevronsUp class="size-4" />
        </IconButton>
        <IconButton
          label="Bring forward"
          size="sm"
          onclick={() => bringForward(activeSlide!.id, selectedObject.id)}
        >
          <ChevronUp class="size-4" />
        </IconButton>
        <IconButton
          label="Send backward"
          size="sm"
          onclick={() => sendBackward(activeSlide!.id, selectedObject.id)}
        >
          <ChevronDown class="size-4" />
        </IconButton>
        <IconButton
          label="Send to back"
          size="sm"
          onclick={() => sendToBack(activeSlide!.id, selectedObject.id)}
        >
          <ChevronsDown class="size-4" />
        </IconButton>
      </div>
    </div>
  </div>
```

Z-order is determined by the array position of the object within `slide.objects` — later indices render on top. Each button calls a dedicated store function (defined in the slide system's `types.ts`) that slices and reinserts the object at the appropriate position, then the canvas rebuilds with the new ordering. The reorder mutators are bounds-checked: the last object cannot be brought forward and the first cannot be sent backward.

## Markup — fallback

### Prompt shown when no object is selected

```svelte
{:else}
  <p class="text-caption text-muted">Select an object to adjust its position and size.</p>
{/if}
```

Shows a prompt when no object is selected rather than an empty panel.

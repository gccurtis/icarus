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

  const activeSlide = $derived($deck?.slides[$activeSlideIndex] ?? null);

  const selectedObject = $derived.by(() => {
    if (!activeSlide || !$activeObjectId) return null;
    return activeSlide.objects.find((o) => o.id === $activeObjectId) ?? null;
  });

  function updateFrame(patch: Partial<{ x: number; y: number; width: number; height: number; rotation: number }>): void {
    const obj = selectedObject;
    if (!obj) return;
    updateSlideObject(activeSlide!.id, obj.id, { frame: { ...obj.frame, ...patch } });
  }
</script>

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
{:else}
  <p class="text-caption text-muted">Select an object to adjust its position and size.</p>
{/if}

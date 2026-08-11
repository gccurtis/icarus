# src/lib/features/stages/slides/FabricCanvas.svelte — breakdown

Companion to [FabricCanvas.svelte](FabricCanvas.svelte). The interactive slide
surface: it renders one `Slide` onto a Fabric.js canvas, fits that canvas into
the available work area (leaving a gutter), and streams edits — moves, resizes,
text changes, selection — back into the slides store.

## Imports and props

### Lifecycle hooks, Fabric primitives, store writers, and the `cn` helper

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Canvas, Rect, Textbox } from 'fabric';
  import type { Deck, Slide, SlideObject } from '$systems/slides';
  import {
    updateSlideObject,
    selectObject
  } from '$systems/slides';
  import { cn } from '$lib/utils';

```

Pulls in Svelte's mount/destroy hooks, the three Fabric classes used here
(`Canvas`, plus `Rect`/`Textbox` for the two supported object kinds), the slide
domain types, the two store mutators this component calls, and `cn` for class
merging.

### Component props

```svelte
  let {
    slide,
    deck: d,
    class: className = ''
  }: { slide: Slide; deck: Deck; class?: string } = $props();

```

Takes the active `slide` to render and the `deck` (aliased `d`, read for its
native `canvas.width`/`canvas.height`). `class` is forwarded onto the wrapper so
the parent can size it (`h-full`).

## Local state and the gutter constant

### Element bindings, the Fabric instance, resize observer, and re-entrancy guard

```svelte
  let canvasEl = $state<HTMLCanvasElement>();
  let wrapEl = $state<HTMLDivElement>();
  let fabric: Canvas | null = null;
  let resizeObs: ResizeObserver | null = null;
  let syncing = false;

  // Minimum gutter (px) kept between the slide and the work-area edges.
  const GUTTER = 40;

```

`canvasEl`/`wrapEl` are `bind:this` targets. `fabric` holds the live canvas
(plain `let`, not `$state` — it is imperative infrastructure, not reactive UI
data). `resizeObs` re-fits on container resize. `syncing` guards against
re-entrant syncs. `GUTTER` is the minimum margin kept between the slide and the
work-area edges.

## Fitting the slide into the viewport

### Drive Fabric's own zoom + display size (not a CSS transform)

```svelte
  // Fit the native deck canvas into the available work area, preserving aspect.
  // We drive Fabric's OWN zoom + display size rather than CSS-transforming the
  // <canvas>: Fabric wraps the element in a `.canvas-container` and adds a second
  // `.upper-canvas` for interaction, so a CSS `transform: scale()` would only
  // shrink the lower canvas — the interaction layer (and everything drawn on it)
  // would stay at native size, overflow the slide, and break pointer hit-testing.
  // setZoom scales the render; setDimensions resizes both canvases + container.
  function fitToViewport(): void {
    if (!fabric || !wrapEl) return;
    const availW = wrapEl.clientWidth - GUTTER * 2;
    const availH = wrapEl.clientHeight - GUTTER * 2;
    if (availW <= 0 || availH <= 0) return;
    const scale = Math.min(availW / d.canvas.width, availH / d.canvas.height);
    if (!(scale > 0)) return;
    fabric.setZoom(scale);
    fabric.setDimensions({ width: d.canvas.width * scale, height: d.canvas.height * scale });
    fabric.requestRenderAll();
  }

```

Computes the largest aspect-preserving scale that fits the native deck canvas
inside `wrapEl` minus the gutter, then applies it through Fabric's API:
`setZoom` scales the drawn content and, crucially, remaps pointer hit-testing;
`setDimensions` resizes the container and *both* the lower (render) and upper
(interaction) canvases together. This is the fix for the earlier breakage where a
raw CSS `transform: scale()` on the `<canvas>` only shrank the lower canvas,
leaving the interaction layer at native 960×540 so objects overflowed and
selection was misaligned. Guards bail out before layout is measured or when the
container is collapsed.

## Rendering a single slide object

### Map a `SlideObject` to a Fabric `Textbox` or `Rect`, tagged with its id

```svelte
  function renderObject(canvas: Canvas, obj: SlideObject): void {
    if (obj.kind === 'text') {
      const style = obj.style;
      const textbox = new Textbox(obj.content ?? '', {
        // frame.x/frame.y are the top-left corner; Fabric v7 defaults origin to
        // 'center', so pin it to top-left or every object shifts up-and-left by
        // half its size (and drags would round-trip the wrong coordinates).
        originX: 'left',
        originY: 'top',
        left: obj.frame.x,
        top: obj.frame.y,
        width: obj.frame.width,
        height: obj.frame.height,
        angle: obj.frame.rotation ?? 0,
        fontSize: style?.fontSize ?? 24,
        fill: style?.color ?? '#23272b',
        textAlign: style?.alignment ?? 'left',
        fontFamily: style?.fontFamily ?? 'IBM Plex Sans',
        fontWeight: style?.bold ? 'bold' : 'normal',
        fontStyle: style?.italic ? 'italic' : 'normal',
        underline: style?.underline ?? false,
        editable: true,
        splitByGrapheme: true
      });
      (textbox as unknown as Record<string, unknown>).slideObjectId = obj.id;
      canvas.add(textbox);
    } else if (obj.kind === 'shape') {
      const rect = new Rect({
        originX: 'left',
        originY: 'top',
        left: obj.frame.x,
        top: obj.frame.y,
        width: obj.frame.width,
        height: obj.frame.height,
        angle: obj.frame.rotation ?? 0,
        fill: obj.style?.fill ?? '#e0e0e0',
        stroke: obj.style?.stroke ?? '#cccccc',
        strokeWidth: obj.style?.strokeWidth ?? 1,
        rx: obj.style?.cornerRadius ?? 4,
        ry: obj.style?.cornerRadius ?? 4
      });
      (rect as unknown as Record<string, unknown>).slideObjectId = obj.id;
      canvas.add(rect);
    }
  }

```

Translates a store `SlideObject` into a Fabric primitive. Both branches pin
`originX/originY` to `'left'/'top'` so the object's `frame.x`/`frame.y`
(top-left corner in slide coordinates) is honored literally — Fabric v7 defaults
origin to `'center'`, which would offset every object by half its size and cause
drags to persist wrong coordinates. Text becomes an editable, grapheme-wrapping
`Textbox` carrying its font/style; shapes become a rounded `Rect`. Each Fabric
object is stamped with a non-standard `slideObjectId` so events can map back to
the store record. Kinds other than `text`/`shape` are silently skipped (not yet
supported).

## Syncing the store slide onto the canvas

### Clear, re-add every object, restore background + selection, then re-fit

```svelte
  function syncToCanvas(): void {
    if (!fabric || syncing) return;
    syncing = true;

    // Preserve the active object ID before clear() destroys everything.
    const activeObj = fabric.getActiveObject();
    const selectedId = (activeObj as unknown as Record<string, unknown>)?.slideObjectId as string | undefined;

    fabric.clear();
    for (const obj of slide.objects) {
      renderObject(fabric, obj);
    }
    // Background must be set AFTER clear() — clear() resets it to transparent.
    fabric.backgroundColor = slide.backgroundColor ?? '#ffffff';
    // Re-establish zoom/display size (clear can reset the viewport) and render.
    fitToViewport();

    // Restore the selection that clear() destroyed.
    if (selectedId) {
      const restored = fabric.getObjects().find(
        (o) => (o as unknown as Record<string, unknown>).slideObjectId === selectedId
      );
      if (restored) {
        fabric.setActiveObject(restored);
      }
    }

    syncing = false;
    fabric.requestRenderAll();
  }

```

Rebuilds the canvas from the current `slide`: it first captures the active
object's `slideObjectId`, since `clear()` destroys the selection along with every
object. It then wipes the canvas, re-adds every object, and sets the background
*after* `clear()` (which resets it to transparent) so the slide fill shows.
`fitToViewport()` re-applies zoom/display size. Finally, if an object was selected
before, the matching re-created object is looked up by id and re-activated — so a
store-driven re-sync (e.g. editing a property in the inspector) does not visibly
drop the selection. The `syncing` flag makes the whole routine non-re-entrant.

## Persisting a move/resize/rotate

### Round the modified frame back into the store, then normalize scale

```svelte
  function onObjectModified(e: { target?: { slideObjectId?: string; left?: number; top?: number; width?: number; height?: number; scaleX?: number; scaleY?: number; angle?: number } }) {
    const obj = e.target;
    if (!obj?.slideObjectId || !fabric) return;
    const id = obj.slideObjectId;
    updateSlideObject(slide.id, id, {
      frame: {
        x: Math.round(obj.left ?? 0),
        y: Math.round(obj.top ?? 0),
        width: Math.round((obj.width ?? 0) * (obj.scaleX ?? 1)),
        height: Math.round((obj.height ?? 0) * (obj.scaleY ?? 1)),
        rotation: Math.round(obj.angle ?? 0)
      }
    });
    // Reset scale so width/height are authoritative and scale stays 1.
    fabric.getObjects().forEach((o) => {
        if ((o as unknown as Record<string, unknown>).slideObjectId === id) {
        o.set({ scaleX: 1, scaleY: 1 });
      }
    });
  }

```

After a drag/resize/rotate, writes the new frame back to the store, folding
Fabric's `scaleX/scaleY` into concrete `width`/`height` (rounded to whole
units). It then resets the object's scale to 1 so width/height remain the single
source of truth rather than accumulating scale factors. Because origin is pinned
top-left, `obj.left`/`obj.top` are already the corner the store expects.

## Persisting a text edit

### Write edited text content back to the store

```svelte
  function onTextChanged(e: { target?: { slideObjectId?: string; text?: string } }) {
    const obj = e.target;
    if (!obj?.slideObjectId) return;
    updateSlideObject(slide.id, obj.slideObjectId, { content: obj.text ?? '' });
  }

```

Mirrors inline text edits into the store's `content` field for the matching
object.

## Selection bridging

### Reflect Fabric's active object into the slides store

```svelte
  function onSelectionCreated(e: { selected?: Array<unknown> }) {
    const first = e.selected?.[0] as { slideObjectId?: string } | undefined;
    selectObject(first?.slideObjectId ?? null);
  }

  function onSelectionCleared() {
    selectObject(null);
  }

```

Keeps the store's `activeObjectId` in step with the canvas selection so the
inspector panels (Text/Shape/Position) show the right object. `created` handles
both new and updated selections (wired to both events below); `cleared` deselects.

## Deselecting on gutter click

### Clear the selection when the click lands outside the canvas container

```svelte
  function onWrapperClick(e: MouseEvent) {
    if (!fabric) return;
    const target = e.target as HTMLElement;
    // Deselect when clicking the gutter outside the Fabric canvas container.
    if (!target.closest('.canvas-container')) {
      fabric.discardActiveObject();
      fabric.requestRenderAll();
    }
  }

```

Clicks on the surrounding gutter (anything not inside Fabric's runtime
`.canvas-container`) discard the active object and re-render, so clicking empty
space deselects — Fabric only fires `selection:cleared` for clicks on its own
canvas, not the wrapper around it.

## Mount: build the canvas, wire events, observe resize

### Instantiate Fabric, sync, subscribe to events, start the ResizeObserver

```svelte
  onMount(() => {
    if (!canvasEl) return;

    fabric = new Canvas(canvasEl, {
      width: d.canvas.width,
      height: d.canvas.height,
      selection: true,
      backgroundColor: slide.backgroundColor ?? '#ffffff'
    });

    syncToCanvas();

    fabric.on('object:modified', onObjectModified);
    fabric.on('text:changed', onTextChanged);
    fabric.on('selection:created', onSelectionCreated);
    fabric.on('selection:updated', onSelectionCreated);
    fabric.on('selection:cleared', onSelectionCleared);

    // Keep the slide fitted as the work area (panels opening, window) resizes.
    resizeObs = new ResizeObserver(() => fitToViewport());
    if (wrapEl) resizeObs.observe(wrapEl);
  });

```

Creates the Fabric canvas at native deck resolution, does an initial sync (which
fits it), subscribes the handlers above (mapping `selection:updated` to the same
handler as `selection:created`), and observes the wrapper so the slide re-fits
whenever the available space changes — a side panel opening or the window
resizing.

## Reacting to slide changes

### Re-sync when the active slide swaps

```svelte
  // React to slide changes (tab switch, slide list selection).
  $effect(() => {
    slide;
    if (fabric) syncToCanvas();
  });

```

Reads `slide` to register it as a dependency, then re-syncs the canvas whenever a
different slide becomes active (tab switch or slide-list click).

## Teardown

### Disconnect the observer, detach handlers, dispose the canvas

```svelte
  onDestroy(() => {
    resizeObs?.disconnect();
    resizeObs = null;
    if (fabric) {
      fabric.off('object:modified', onObjectModified);
      fabric.off('text:changed', onTextChanged);
      fabric.off('selection:created', onSelectionCreated);
      fabric.off('selection:updated', onSelectionCreated);
      fabric.off('selection:cleared', onSelectionCleared);
      fabric.dispose();
      fabric = null;
    }
  });
</script>

```

Cleans up on unmount: stop observing resizes, unsubscribe every Fabric event, and
`dispose()` the canvas (which tears down its DOM wrappers and listeners),
preventing leaks across tab switches.

## Markup

### Centered wrapper holding the bound canvas

```svelte
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={wrapEl} class={cn('flex h-full w-full items-center justify-center overflow-hidden', className)} onclick={onWrapperClick}>
  <canvas bind:this={canvasEl}></canvas>
</div>

```

The wrapper fills its parent and flex-centers the Fabric canvas so the slide sits
in the middle of the work area with an even gutter on all sides; `overflow-hidden`
keeps a slightly-too-large canvas from spilling past the region. Its `onclick`
routes to `onWrapperClick` for gutter-deselect; the two `svelte-ignore` comments
suppress a11y warnings for the click-only static element. Fabric replaces the bare
`<canvas>` with its own `.canvas-container` wrapper at runtime.

## Styles

### Float the slide as a shadowed panel

```svelte
<style>
  /* Float the slide as a panel above the darker work-area gutter. Fabric wraps
     the <canvas> in `.canvas-container`; style that wrapper with a shadow. */
  div :global(.canvas-container) {
    border-radius: 0;
    box-shadow: var(--shadow-panel);
    overflow: hidden;
  }
</style>
```

Targets the runtime-created `.canvas-container` (via `:global`, since Fabric adds
it outside Svelte's scoping) to give the slide a drop shadow so it reads as a
sheet floating over the darker `bg-canvas` gutter. Corners are square
(`border-radius: 0`), and `overflow: hidden` keeps the two square inner canvases
clipped to the container.

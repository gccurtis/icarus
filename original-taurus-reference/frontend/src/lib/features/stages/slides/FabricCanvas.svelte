<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Canvas, Rect, Textbox } from 'fabric';
  import type { Deck, Slide, SlideObject } from '$systems/slides';
  import {
    updateSlideObject,
    selectObject
  } from '$systems/slides';
  import { cn } from '$lib/utils';

  let {
    slide,
    deck: d,
    class: className = ''
  }: { slide: Slide; deck: Deck; class?: string } = $props();

  let canvasEl = $state<HTMLCanvasElement>();
  let wrapEl = $state<HTMLDivElement>();
  let fabric: Canvas | null = null;
  let resizeObs: ResizeObserver | null = null;
  let syncing = false;

  // Minimum gutter (px) kept between the slide and the work-area edges.
  const GUTTER = 40;

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

  function onTextChanged(e: { target?: { slideObjectId?: string; text?: string } }) {
    const obj = e.target;
    if (!obj?.slideObjectId) return;
    updateSlideObject(slide.id, obj.slideObjectId, { content: obj.text ?? '' });
  }

  function onSelectionCreated(e: { selected?: Array<unknown> }) {
    const first = e.selected?.[0] as { slideObjectId?: string } | undefined;
    selectObject(first?.slideObjectId ?? null);
  }

  function onSelectionCleared() {
    selectObject(null);
  }

  function onWrapperClick(e: MouseEvent) {
    if (!fabric) return;
    const target = e.target as HTMLElement;
    // Deselect when clicking the gutter outside the Fabric canvas container.
    if (!target.closest('.canvas-container')) {
      fabric.discardActiveObject();
      fabric.requestRenderAll();
    }
  }

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

  // React to slide changes (tab switch, slide list selection).
  $effect(() => {
    slide;
    if (fabric) syncToCanvas();
  });

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

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div bind:this={wrapEl} class={cn('flex h-full w-full items-center justify-center overflow-hidden', className)} onclick={onWrapperClick}>
  <canvas bind:this={canvasEl}></canvas>
</div>

<style>
  /* Float the slide as a panel above the darker work-area gutter. Fabric wraps
     the <canvas> in `.canvas-container`; style that wrapper with a shadow. */
  div :global(.canvas-container) {
    border-radius: 0;
    box-shadow: var(--shadow-panel);
    overflow: hidden;
  }
</style>

<script lang="ts">
  import { cn, type WithElementRef } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    class: className,
    gap = 16,
    label = "Scrollable shelf",
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & { gap?: number; label?: string } = $props();

  const trace = traceNode("CarouselShelf", () => ({ gap, label }));

  let track: HTMLDivElement | null = null;
  let pointer: number | undefined;
  let pointerStart = 0;
  let scrollStart = 0;
  let moved = false;
  let suppressClick = false;
  let dragging = $state(false);

  const pointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || track === null) return;
    pointer = event.pointerId;
    pointerStart = event.clientX;
    scrollStart = track.scrollLeft;
    moved = false;
  };

  const pointerMove = (event: PointerEvent) => {
    if (pointer !== event.pointerId || track === null) return;
    const delta = event.clientX - pointerStart;
    if (!moved && Math.abs(delta) < 4) return;
    if (!moved) {
      moved = true;
      dragging = true;
      track.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    track.scrollLeft = scrollStart - delta;
  };

  const finishPointer = (event: PointerEvent) => {
    if (pointer !== event.pointerId || track === null) return;
    if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    suppressClick = moved;
    dragging = false;
    moved = false;
    pointer = undefined;
  };

  const captureClick = (event: MouseEvent) => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClick = false;
  };

  /** Vertical wheels become horizontal here; native horizontal/Shift-wheel remains horizontal. */
  const wheel = (event: WheelEvent) => {
    if (track === null) return;
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? track.clientWidth
        : 1;
    const delta = (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * unit;
    if (delta === 0) return;
    const before = track.scrollLeft;
    track.scrollLeft += delta;
    if (track.scrollLeft !== before) event.preventDefault();
  };
</script>

<!--
  A recessed, horizontally scrollable shelf.

  The shelf used to be an Embla carousel with looping controls and broad fading
  overlays. Those layers competed with the first and last cards, hid part of
  their iconography, and made a finite history row look infinite. A native
  scrollport keeps the whole card visible, preserves wheel, trackpad, touch and
  keyboard scrolling, and paints the quiet bottom scrollbar as the affordance.
  A narrow inset shadow remains over the scrollport: it is the same contact cue
  used by the document pasteboard, and says that cards pass beneath the well's
  edge without obscuring their contents.

  The padding belongs inside the scrollport. It gives raised card shadows room
  before clipping at the well and leaves a small gutter between the cards and
  the scrollbar thumb.
-->
<div
  {...trace}
  bind:this={ref}
  data-slot="carousel-shelf"
  class={cn(
    "bg-surface-panel border-border-subtle rounded-overlay relative overflow-hidden border",
    className
  )}
  {...restProps}
>
  <!-- The scrollport must receive focus for arrow-key scrolling; `region`
       remains the right role because pressing it performs no application act. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    bind:this={track}
    class="shelf-track"
    class:dragging
    style:--shelf-gap={`${gap}px`}
    role="region"
    aria-label={label}
    tabindex="0"
    onpointerdown={pointerDown}
    onpointermove={pointerMove}
    onpointerup={finishPointer}
    onpointercancel={finishPointer}
    onclickcapture={captureClick}
    onwheel={wheel}
  >
    {@render children?.()}
  </div>
  <div class="shelf-recess" aria-hidden="true"></div>
</div>

<style>
  .shelf-track {
    display: flex;
    min-width: 0;
    align-items: flex-start;
    gap: var(--shelf-gap);
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-inline: contain;
    margin-inline: calc(var(--token-spacing-unit) * 1);
    padding: calc(var(--token-spacing-unit) * 3) calc(var(--token-spacing-unit) * 2)
      calc(var(--token-spacing-unit) * 1.5);
    scrollbar-color: var(--token-border-strong) transparent;
    scrollbar-width: thin;
    cursor: grab;
    touch-action: pan-y;
  }

  .shelf-track.dragging {
    cursor: grabbing;
    scroll-behavior: auto;
    user-select: none;
  }

  .shelf-recess {
    position: absolute;
    z-index: 1;
    inset: 0;
    border-radius: inherit;
    box-shadow:
      inset 0 8px 9px -9px var(--token-shadow-occlusion),
      inset 9px 0 10px -10px var(--token-shadow-occlusion),
      inset -9px 0 10px -10px var(--token-shadow-occlusion),
      inset 0 -7px 8px -9px var(--token-shadow-occlusion);
    pointer-events: none;
  }

  .shelf-track:focus-visible {
    outline: 2px solid var(--token-color-interactive-border);
    outline-offset: -2px;
  }

  .shelf-track::-webkit-scrollbar {
    height: calc(var(--token-spacing-unit) * 1);
  }

  .shelf-track::-webkit-scrollbar-track {
    background: transparent;
    margin-inline: calc(var(--token-spacing-unit) * 1.5);
  }

  .shelf-track::-webkit-scrollbar-thumb {
    border-radius: var(--token-radius-control);
    background: var(--token-border-strong);
  }

  .shelf-track::-webkit-scrollbar-thumb:hover {
    background: var(--token-ink-muted);
  }
</style>

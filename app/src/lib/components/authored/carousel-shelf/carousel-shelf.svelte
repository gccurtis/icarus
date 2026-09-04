<script lang="ts">
  import { cn, type WithElementRef } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    class: className,
    gap = 16,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & { gap?: number } = $props();

  const trace = traceNode("CarouselShelf", () => ({ gap }));
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
    class="shelf-track"
    style:--shelf-gap={`${gap}px`}
    role="region"
    aria-label="Scrollable shelf"
    tabindex="0"
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

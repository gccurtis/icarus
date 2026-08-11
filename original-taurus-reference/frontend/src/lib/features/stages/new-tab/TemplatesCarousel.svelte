<script lang="ts">
  import { onMount, type Component } from 'svelte';
  import { cn } from '$lib/utils';
  import { type Tone } from '$lib/components';
  import { iconTileClass } from '$data/projects';
  import { type ResourceKind } from '$data/resources';

  type KindMeta = Record<ResourceKind, { icon: Component; tone: Tone; label: string }>;
  type Template = { id: string; name: string; kind: ResourceKind; blurb: string };

  let {
    templates,
    kindMeta,
    onpick
  }: { templates: Template[]; kindMeta: KindMeta; onpick: (t: Template) => void } = $props();

  let stripEl = $state<HTMLDivElement>();
  // Distance between the start of one copy and the next; used to wrap seamlessly.
  let stride = 0;

  // Three copies so scrolling wraps cyclically (start centered on the middle copy).
  const loop = $derived([...templates, ...templates, ...templates]);

  function measure() {
    if (!stripEl) return;
    const kids = stripEl.children;
    if (kids.length > templates.length) {
      stride = (kids[templates.length] as HTMLElement).offsetLeft - (kids[0] as HTMLElement).offsetLeft;
      // Re-center only if we're outside the middle copy (don't fight the user's scroll).
      if (stride > 0 && (stripEl.scrollLeft < stride || stripEl.scrollLeft >= 2 * stride)) {
        stripEl.scrollLeft = stride;
      }
    }
  }

  onMount(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (stripEl) ro.observe(stripEl);
    return () => ro.disconnect();
  });

  // As the user scrolls out of the middle copy, jump back by one copy — invisibly,
  // since the copies are identical — so it loops forever in both directions.
  function onScroll() {
    if (!stride || !stripEl) return;
    const x = stripEl.scrollLeft;
    if (x >= 2 * stride) stripEl.scrollLeft = x - stride;
    else if (x < stride) stripEl.scrollLeft = x + stride;
  }

  function onWheel(e: WheelEvent) {
    if (!stripEl) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      stripEl.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }
</script>

<!-- Bordered frame keeps a crisp edge; the inner strip fades its cards toward that border. -->
<div class="overflow-hidden rounded-panel border border-border bg-canvas">
  <div
    bind:this={stripEl}
    onscroll={onScroll}
    onwheel={onWheel}
    class="tmpl-carousel flex gap-2 overflow-x-auto p-3"
  >
    {#each loop as t, i (i)}
      {@const meta = kindMeta[t.kind]}
      {@const Icon = meta.icon}
      <button
        onclick={() => onpick(t)}
        class="surface-panel dur-small flex w-44 shrink-0 flex-col gap-1.5 rounded-control p-3 text-left transition-all hover:-translate-y-0.5 hover:bg-elevated hover:shadow-panel"
      >
        <span class={cn('flex size-7 items-center justify-center rounded-control', iconTileClass(meta.tone))}>
          <Icon class="size-4" />
        </span>
        <span class="text-body-sm font-medium text-primary">{t.name}</span>
        <span class="text-caption text-muted">{t.blurb}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  /* Hide the scrollbar; fade the cards toward the edges (inside the frame's border,
     so the border stays crisp and the section doesn't look like it fades in/out). */
  .tmpl-carousel {
    scrollbar-width: none;
    -webkit-mask-image: linear-gradient(to right, transparent, #000 2rem, #000 calc(100% - 2rem), transparent);
    mask-image: linear-gradient(to right, transparent, #000 2rem, #000 calc(100% - 2rem), transparent);
  }
  .tmpl-carousel::-webkit-scrollbar {
    display: none;
  }
</style>

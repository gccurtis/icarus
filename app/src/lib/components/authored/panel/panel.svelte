<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$lib/components/vendor/utils";
  import { traceNode } from "$components/development/trace.svelte";

  /**
   * The frame every context view and every inspector lens is built in.
   *
   * Three bands: an optional trail, a title with its controls, and the body.
   * The body scrolls; nothing else does.
   *
   * **Controls are at the top, and there is nowhere else to put them.** A
   * pinned footer band buries every button in it: last in reading order, below
   * content of unbounded length, in the one part of a full-height panel a reader
   * has no reason to look at. What a panel offers has to be visible before what
   * it lists, because the list is why the reader is looking down. Anything the
   * panel wants to say *after* its contents is a `PanelNote` at the end of the
   * body — prose at the bottom is a footnote, which is a thing worth having; a
   * control at the bottom is a control nobody finds.
   *
   * **There is no search band either.** A field pinned by the frame leaves the
   * scope of the search unanswerable: this component renders it and can know
   * nothing of what is below it, so what any given search filters is a
   * convention held in the caller. `PanelSearch` contains what it searches, so
   * the question is answered by the markup rather than by a convention.
   *
   * **It owns the zone's only scroll.** The flank views hand this their full
   * height and do not scroll themselves, because nesting scroll contexts inside
   * a panel makes a scroll position unrecoverable: restoring the outer one
   * leaves the inner one wherever it was.
   *
   * **No scrollbar.** Every panel scrolls and none spends width saying so, so no
   * panel gets a gutter its neighbour lacks. The content is reachable by wheel,
   * trackpad, keyboard and touch exactly as it would be with one painted.
   */
  let {
    title,
    crumbs,
    actions,
    children,
    class: className
  }: {
    /** Names the view. Rendered as the panel's heading, so it is never empty. */
    title: string;
    /**
     * Where the inspected thing sits, above the title. Inspector lenses carry
     * one; context views do not, because a context view is not inside anything.
     */
    crumbs?: Snippet;
    /**
     * What this panel offers, in a row under the title: the way out to the
     * screen that owns this, the thing it makes, the filters over it.
     */
    actions?: Snippet;
    children: Snippet;
    class?: string;
  } = $props();

  const trace = traceNode("Panel", () => ({ title }));
</script>

<section {...trace} class={cn("flex h-full min-h-0 flex-col", className)}>
  {#if crumbs}
    {@render crumbs()}
  {/if}

  <header class="flex flex-col gap-2 px-3 pt-3 pb-2" class:pb-1={actions !== undefined}>
    <h2 class="text-label text-ink-secondary m-0 font-semibold">{title}</h2>
    {#if actions}
      <div class="flex flex-wrap items-center gap-1">{@render actions()}</div>
    {/if}
  </header>

  <!--
    `min-h-0` is what makes the scroll work at all: a flex child's default
    `min-height: auto` refuses to shrink below its content, so without it the
    body grows the panel past the zone and the whole flank scrolls instead.
  -->
  <div
    class="min-h-0 flex-1 overflow-y-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  >
    {@render children()}
  </div>
</section>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  /**
   * The scrolling half of a side-panel lens.
   *
   * `SidePanel` gives a panel one `min-h-0 flex-1 overflow-auto px-3 pb-3` box.
   * A lens that wants a head block to stay put (import/export, a search field,
   * filter chips) makes its own root `flex h-full flex-col` and hands everything
   * below the head to this component: `h-full` resolves against the outer box's
   * CONTENT height, so that scroller's scrollHeight equals its clientHeight and
   * it never engages — this is the only thing that scrolls. No sticky
   * positioning, and no change to `SidePanel` for the panels that don't do this.
   */
  let { class: className = '', children }: { class?: string; children?: Snippet } = $props();
</script>

<div class={cn('panel-results min-h-0 flex-1 overflow-auto', className)}>
  {@render children?.()}
</div>

<style>
  /* Matches SidePanel: the rails hide their scrollbars and scroll by wheel/drag. */
  .panel-results {
    scrollbar-width: none;
  }

  .panel-results::-webkit-scrollbar {
    display: none;
  }
</style>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cn } from '$lib/utils';
  import { motionDuration } from '$lib/motion';

  let {
    open = $bindable(false),
    placement = 'bottom',
    class: className = '',
    triggerClass = '',
    label = undefined,
    trigger,
    children
  }: {
    open?: boolean;
    placement?: 'bottom' | 'top' | 'bottom-end';
    class?: string;
    /** Classes for the trigger button (pass plain content, not a <button>). */
    triggerClass?: string;
    label?: string;
    trigger?: Snippet;
    children?: Snippet;
  } = $props();

  let triggerEl = $state<HTMLButtonElement>();
  // Fixed viewport coords (computed from the trigger rect) so the panel escapes any
  // overflow-clipping / scrolling ancestor.
  let coords = $state({ top: 0, bottom: 0, left: 0, right: 0 });

  function toggle() {
    if (!open && triggerEl) {
      const r = triggerEl.getBoundingClientRect();
      coords = {
        top: r.bottom + 8,
        bottom: window.innerHeight - r.top + 8,
        left: r.left,
        right: window.innerWidth - r.right
      };
    }
    open = !open;
  }

  const panelStyle = $derived(
    placement === 'top'
      ? `position: fixed; bottom: ${coords.bottom}px; left: ${coords.left}px;`
      : placement === 'bottom-end'
        ? `position: fixed; top: ${coords.top}px; right: ${coords.right}px;`
        : `position: fixed; top: ${coords.top}px; left: ${coords.left}px;`
  );

  function onKeydown(e: KeyboardEvent) {
    if (open && e.key === 'Escape') {
      open = false;
      triggerEl?.focus();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class={cn('relative inline-flex', className)}>
  <button
    bind:this={triggerEl}
    type="button"
    aria-expanded={open}
    aria-label={label}
    class={triggerClass || undefined}
    onclick={toggle}
  >
    {@render trigger?.()}
  </button>
  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fixed inset-0 z-40" onclick={() => (open = false)}></div>
    <div
      transition:fade={{ duration: motionDuration(100) }}
      style={panelStyle}
      class="surface-elevated z-50 min-w-48 p-2"
    >
      {@render children?.()}
    </div>
  {/if}
</div>

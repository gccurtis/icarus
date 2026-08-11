<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cn } from '$lib/utils';
  import { motionDuration } from '$lib/motion';

  type Item = {
    label?: string;
    onselect?: () => void;
    href?: string;
    danger?: boolean;
    disabled?: boolean;
    divider?: boolean;
  };

  let {
    items = [],
    align = 'start',
    class: className = '',
    triggerClass = '',
    label = undefined,
    title = undefined,
    trigger
  }: {
    items?: Item[];
    align?: 'start' | 'end';
    class?: string;
    /** Classes for the trigger button (pass plain content, not a <button>). */
    triggerClass?: string;
    label?: string;
    /** Native tooltip, so a control can read one way to a screen reader and another on hover. */
    title?: string;
    trigger?: Snippet;
  } = $props();

  let open = $state(false);
  let triggerEl = $state<HTMLButtonElement>();
  // Positioned with fixed viewport coordinates (computed from the trigger) so the
  // dropdown escapes any scrolling / overflow-clipping ancestor.
  let pos = $state({ top: 0, left: 0, right: 0 });

  function toggle() {
    if (!open && triggerEl) {
      const r = triggerEl.getBoundingClientRect();
      pos = { top: r.bottom + 6, left: r.left, right: window.innerWidth - r.right };
    }
    open = !open;
  }

  function select(it: Item) {
    if (it.disabled) return;
    it.onselect?.();
    open = false;
  }

  // Escape closes and returns focus to the trigger — the same contract Popover
  // has always had. Without it the only way out of an open menu was clicking the
  // backdrop, which leaves keyboard users stuck.
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
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label={label}
    {title}
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
      role="menu"
      transition:fade={{ duration: motionDuration(100) }}
      style="position: fixed; top: {pos.top}px; {align === 'end' ? `right: ${pos.right}` : `left: ${pos.left}`}px;"
      class="surface-elevated z-50 min-w-44 p-1"
    >
      {#each items as it, i (i)}
        {#if it.divider}
          <div class="my-1 h-px bg-border"></div>
        {:else if it.href}
          <a
            href={it.href}
            role="menuitem"
            class="dur-micro block rounded-control px-3 py-1.5 text-body-sm text-secondary transition-colors hover:bg-panel hover:text-primary"
          >
            {it.label}
          </a>
        {:else}
          <button
            type="button"
            role="menuitem"
            disabled={it.disabled}
            onclick={() => select(it)}
            class={cn(
              'dur-micro block w-full rounded-control px-3 py-1.5 text-left text-body-sm transition-colors hover:bg-panel disabled:pointer-events-none disabled:opacity-40',
              it.danger ? 'text-danger' : 'text-secondary hover:text-primary'
            )}
          >
            {it.label}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

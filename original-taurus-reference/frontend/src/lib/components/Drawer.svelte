<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cn } from '$lib/utils';
  import { motionDuration, EASE } from '$lib/motion';

  let {
    open = $bindable(false),
    side = 'right',
    title = undefined,
    width = 360,
    class: className = '',
    children
  }: {
    open?: boolean;
    side?: 'left' | 'right';
    title?: string;
    width?: number;
    class?: string;
    children?: Snippet;
  } = $props();

  function close() {
    open = false;
  }
  function onkeydown(e: KeyboardEvent) {
    if (open && e.key === 'Escape') close();
  }

  const x = $derived(side === 'right' ? width : -width);
</script>

<svelte:window {onkeydown} />

{#if open}
  <div class="fixed inset-0 z-50">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute inset-0 bg-black/40 backdrop-blur-sm"
      transition:fade={{ duration: motionDuration(200) }}
      onclick={close}
      aria-hidden="true"
    ></div>
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      transition:fly={{ x, duration: motionDuration(260), easing: EASE }}
      class={cn(
        'surface-panel absolute inset-y-0 flex flex-col shadow-overlay',
        side === 'right' ? 'right-0' : 'left-0',
        className
      )}
      style={`width:${width}px`}
    >
      {#if title}
        <div class="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 class="text-body font-semibold text-primary">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onclick={close}
            class="dur-micro rounded-control p-1 text-muted transition-colors hover:bg-elevated hover:text-primary"
          >
            <svg
              class="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg
            >
          </button>
        </div>
      {/if}
      <div class="flex-1 overflow-y-auto px-5 py-4 text-body-sm text-secondary">
        {@render children?.()}
      </div>
    </div>
  </div>
{/if}

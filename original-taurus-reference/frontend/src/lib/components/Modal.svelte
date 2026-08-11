<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cn } from '$lib/utils';
  import { motionDuration, EASE } from '$lib/motion';

  let {
    open = $bindable(false),
    title = undefined,
    size = 'md',
    class: className = '',
    children,
    footer
  }: {
    open?: boolean;
    title?: string;
    size?: 'sm' | 'md' | 'lg';
    class?: string;
    children?: Snippet;
    footer?: Snippet;
  } = $props();

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const;

  function close() {
    open = false;
  }

  function onkeydown(e: KeyboardEvent) {
    if (open && e.key === 'Escape') close();
  }
</script>

<svelte:window {onkeydown} />

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
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
      transition:scale={{ duration: motionDuration(220), start: 0.97, easing: EASE }}
      class={cn('surface-elevated relative z-10 w-full', sizes[size], className)}
    >
      {#if title}
        <div class="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 class="text-body font-semibold text-primary">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onclick={close}
            class="dur-micro rounded-control p-1 text-muted transition-colors hover:bg-panel hover:text-primary"
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
      <div class="px-5 py-4 text-body-sm text-secondary">{@render children?.()}</div>
      {#if footer}
        <div class="flex justify-end gap-2 border-t border-border px-5 py-3">{@render footer()}</div>
      {/if}
    </div>
  </div>
{/if}

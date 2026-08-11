<script lang="ts">
  import type { Snippet } from 'svelte';
  import { slide } from 'svelte/transition';
  import { cn } from '$lib/utils';
  import { motionDuration, EASE } from '$lib/motion';

  let {
    title,
    collapsible = true,
    open = $bindable(true),
    class: className = '',
    children,
    action
  }: {
    title: string;
    collapsible?: boolean;
    open?: boolean;
    class?: string;
    children?: Snippet;
    /** Optional trailing control (e.g. an IconButton). */
    action?: Snippet;
  } = $props();
</script>

<section class={cn('border-b border-border', className)}>
  <div class="flex items-center justify-between px-4 py-2.5">
    {#if collapsible}
      <button
        type="button"
        aria-expanded={open}
        onclick={() => (open = !open)}
        class="dur-micro flex items-center gap-1.5 text-label font-semibold uppercase tracking-wide text-muted transition-colors hover:text-secondary"
      >
        <svg
          class={cn('dur-small size-3.5 transition-transform', !open && '-rotate-90')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg
        >
        {title}
      </button>
    {:else}
      <span class="text-label font-semibold uppercase tracking-wide text-muted">{title}</span>
    {/if}
    {#if action}<span>{@render action()}</span>{/if}
  </div>
  {#if open}
    <div transition:slide={{ duration: motionDuration(180), easing: EASE }} class="px-4 pb-4">
      {@render children?.()}
    </div>
  {/if}
</section>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cn } from '$lib/utils';
  import { motionDuration } from '$lib/motion';

  let {
    content,
    placement = 'top',
    class: className = '',
    children
  }: {
    content: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    class?: string;
    children?: Snippet;
  } = $props();

  let open = $state(false);

  const pos = {
    top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
    bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
    left: 'right-full top-1/2 mr-2 -translate-y-1/2',
    right: 'left-full top-1/2 ml-2 -translate-y-1/2'
  } as const;
</script>

<!-- Hover/focus container; the interactive trigger is the child. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  class={cn('relative inline-flex', className)}
  onmouseenter={() => (open = true)}
  onmouseleave={() => (open = false)}
  onfocusin={() => (open = true)}
  onfocusout={() => (open = false)}
>
  {@render children?.()}
  {#if open}
    <span
      role="tooltip"
      transition:fade={{ duration: motionDuration(100) }}
      class={cn(
        'pointer-events-none absolute z-50 whitespace-nowrap rounded-control border border-border bg-elevated px-2 py-1 text-caption text-primary shadow-overlay',
        pos[placement]
      )}
    >
      {content}
    </span>
  {/if}
</span>

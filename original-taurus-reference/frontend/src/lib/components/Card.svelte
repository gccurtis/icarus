<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  let {
    variant = 'panel',
    class: className = '',
    header,
    footer,
    children,
    ...rest
  }: {
    variant?: 'panel' | 'work' | 'elevated';
    class?: string;
    header?: Snippet;
    footer?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
  } = $props();

  const variants = {
    panel: 'surface-panel rounded-panel',
    work: 'surface-work rounded-panel border border-border',
    elevated: 'surface-elevated'
  } as const;
</script>

<div class={cn(variants[variant], className)} {...rest}>
  {#if header}
    <div class="border-b border-border px-5 py-3 text-body-sm font-semibold text-primary">
      {@render header()}
    </div>
  {/if}
  <div class="p-5">{@render children?.()}</div>
  {#if footer}
    <div class="border-t border-border px-5 py-3">{@render footer()}</div>
  {/if}
</div>

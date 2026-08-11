<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  let {
    block = false,
    class: className = '',
    children
  }: { block?: boolean; class?: string; children?: Snippet } = $props();
</script>

{#if block}
  <pre
    class={cn(
      'overflow-x-auto rounded-panel border border-border bg-panel p-4 font-mono text-mono text-secondary',
      className
    )}><code>{@render children?.()}</code></pre>
{:else}
  <code
    class={cn(
      'rounded-[4px] border border-border bg-panel px-1.5 py-0.5 font-mono text-[0.85em] text-secondary',
      className
    )}>{@render children?.()}</code>
{/if}

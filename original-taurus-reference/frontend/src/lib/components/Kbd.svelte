<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  let { class: className = '', children }: { class?: string; children?: Snippet } = $props();
</script>

<kbd
  class={cn(
    'inline-flex min-w-6 items-center justify-center rounded-control border border-border bg-elevated px-1.5 py-0.5 font-mono text-caption text-secondary shadow-panel',
    className
  )}
>
  {@render children?.()}
</kbd>

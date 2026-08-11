<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  let {
    for: forId = undefined,
    class: className = '',
    children
  }: { for?: string; class?: string; children?: Snippet } = $props();
</script>

<label for={forId} class={cn('text-label font-medium text-secondary', className)}>
  {@render children?.()}
</label>

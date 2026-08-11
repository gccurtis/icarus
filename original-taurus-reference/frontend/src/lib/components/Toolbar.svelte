<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  let {
    class: className = '',
    start,
    center,
    end
  }: { class?: string; start?: Snippet; center?: Snippet; end?: Snippet } = $props();
</script>

<div class={cn('surface-panel flex h-tabstrip items-center gap-2 px-3', className)}>
  <div class="flex items-center gap-1">{@render start?.()}</div>
  {#if center}
    <div class="flex flex-1 items-center justify-center gap-1">{@render center()}</div>
  {:else}
    <div class="flex-1"></div>
  {/if}
  <div class="flex items-center gap-1">{@render end?.()}</div>
</div>

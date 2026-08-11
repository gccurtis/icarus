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

<header class={cn('surface-panel flex h-topbar items-center gap-3 px-4', className)}>
  <div class="flex items-center gap-2">{@render start?.()}</div>
  {#if center}
    <div class="flex flex-1 items-center justify-center">{@render center()}</div>
  {:else}
    <div class="flex-1"></div>
  {/if}
  <div class="flex items-center gap-2">{@render end?.()}</div>
</header>

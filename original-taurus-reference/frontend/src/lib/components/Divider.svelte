<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  let {
    orientation = 'horizontal',
    class: className = '',
    children
  }: {
    orientation?: 'horizontal' | 'vertical';
    /** Optional centered label (horizontal only). */
    children?: Snippet;
    class?: string;
  } = $props();
</script>

{#if orientation === 'vertical'}
  <div
    role="separator"
    aria-orientation="vertical"
    class={cn('w-px self-stretch bg-border', className)}
  ></div>
{:else if children}
  <div class={cn('flex items-center gap-3 text-caption text-muted', className)}>
    <span class="h-px flex-1 bg-border"></span>
    {@render children()}
    <span class="h-px flex-1 bg-border"></span>
  </div>
{:else}
  <hr class={cn('h-px w-full border-0 bg-border', className)} />
{/if}

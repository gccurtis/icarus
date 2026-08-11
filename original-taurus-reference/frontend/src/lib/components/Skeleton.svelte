<script lang="ts">
  import { cn } from '$lib/utils';

  let {
    class: className = '',
    rounded = 'rounded-control'
  }: { class?: string; rounded?: string } = $props();
</script>

<div class={cn('animate-pulse bg-border/70', rounded, className)} aria-hidden="true"></div>

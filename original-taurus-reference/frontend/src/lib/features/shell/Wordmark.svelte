<script lang="ts">
  // The centered brand mark in the top bar. Deliberately faint for now — this is
  // the single place to swap in a stylized logo / display font later (drop the
  // logo here and the top bar picks it up unchanged).
  import { cn } from '$lib/utils';

  let { class: className = '' }: { class?: string } = $props();
</script>

<span
  class={cn(
    'select-none font-mono text-caption lowercase tracking-[0.3em] text-muted/50',
    className
  )}
>
  taurus
</span>

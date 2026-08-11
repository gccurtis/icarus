<script lang="ts">
  import { cn } from '$lib/utils';

  type Segment = { value: string; label: string };

  let {
    value = $bindable(''),
    segments = [],
    class: className = ''
  }: {
    value?: string;
    segments?: Segment[];
    class?: string;
  } = $props();
</script>

<div class={cn('inline-flex items-center gap-1 rounded-control border border-border bg-panel p-1', className)}>
  {#each segments as seg (seg.value)}
    <button
      type="button"
      aria-pressed={value === seg.value}
      onclick={() => (value = seg.value)}
      class={cn(
        'dur-small rounded-[5px] px-3 py-1 text-label font-medium transition-colors',
        value === seg.value ? 'bg-work text-primary shadow-panel' : 'text-muted hover:text-secondary'
      )}
    >
      {seg.label}
    </button>
  {/each}
</div>

<script lang="ts">
  import { cn } from '$lib/utils';
  import type { Tone } from './types';

  let {
    value = 0,
    max = 100,
    tone = 'action',
    label = undefined,
    indeterminate = false,
    class: className = ''
  }: {
    value?: number;
    max?: number;
    tone?: Tone;
    label?: string;
    indeterminate?: boolean;
    class?: string;
  } = $props();

  const pct = $derived(Math.max(0, Math.min(100, (value / max) * 100)));

  const bar: Record<Tone, string> = {
    neutral: 'bg-muted',
    action: 'bg-action',
    intel: 'bg-intel',
    focus: 'bg-focus',
    attention: 'bg-attention',
    success: 'bg-success',
    danger: 'bg-danger'
  };
</script>

<div class={cn('w-full', className)}>
  {#if label}
    <div class="mb-1 flex justify-between text-caption text-muted">
      <span>{label}</span>
      {#if !indeterminate}<span class="tabular-nums">{Math.round(pct)}%</span>{/if}
    </div>
  {/if}
  <div
    role="progressbar"
    aria-valuenow={indeterminate ? undefined : value}
    aria-valuemin={0}
    aria-valuemax={max}
    class="h-1.5 w-full overflow-hidden rounded-full bg-border"
  >
    {#if indeterminate}
      <div class={cn('h-full w-1/3 animate-pulse rounded-full', bar[tone])}></div>
    {:else}
      <div
        class={cn('dur-panel h-full rounded-full transition-all', bar[tone])}
        style={`width:${pct}%`}
      ></div>
    {/if}
  </div>
</div>

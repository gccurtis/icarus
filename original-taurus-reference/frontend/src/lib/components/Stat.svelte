<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';
  import type { Tone } from './types';

  let {
    label,
    value,
    delta = undefined,
    deltaTone = 'neutral',
    icon,
    class: className = ''
  }: {
    label: string;
    value: string | number;
    delta?: string;
    deltaTone?: Tone;
    icon?: Snippet;
    class?: string;
  } = $props();

  const tones: Record<Tone, string> = {
    neutral: 'text-muted',
    action: 'text-action',
    intel: 'text-intel',
    focus: 'text-focus',
    attention: 'text-attention',
    success: 'text-success',
    danger: 'text-danger'
  };
</script>

<div class={cn('surface-panel rounded-panel p-4', className)}>
  <div class="flex items-center justify-between">
    <p class="text-label uppercase tracking-wide text-muted">{label}</p>
    {#if icon}<span class="text-muted">{@render icon()}</span>{/if}
  </div>
  <p class="mt-2 text-h3 font-semibold tabular-nums text-primary">{value}</p>
  {#if delta}
    <p class={cn('mt-1 text-caption font-medium tabular-nums', tones[deltaTone])}>{delta}</p>
  {/if}
</div>

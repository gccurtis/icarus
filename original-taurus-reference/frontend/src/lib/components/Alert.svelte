<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';
  import type { Tone } from './types';

  let {
    tone = 'neutral',
    title = undefined,
    icon,
    class: className = '',
    children
  }: {
    tone?: Tone;
    title?: string;
    icon?: Snippet;
    class?: string;
    children?: Snippet;
  } = $props();

  const tones: Record<Tone, string> = {
    neutral: 'border-border bg-panel',
    action: 'border-action/30 bg-action/8',
    intel: 'border-intel/30 bg-intel/8',
    focus: 'border-focus/30 bg-focus/8',
    attention: 'border-attention/35 bg-attention/10',
    success: 'border-success/30 bg-success/8',
    danger: 'border-danger/30 bg-danger/8'
  };

  const accent: Record<Tone, string> = {
    neutral: 'text-muted',
    action: 'text-action',
    intel: 'text-intel',
    focus: 'text-focus',
    attention: 'text-attention',
    success: 'text-success',
    danger: 'text-danger'
  };
</script>

<div role="note" class={cn('flex gap-3 rounded-panel border p-4', tones[tone], className)}>
  {#if icon}<span class={cn('mt-0.5 shrink-0', accent[tone])}>{@render icon()}</span>{/if}
  <div class="min-w-0 flex-1 text-body-sm text-secondary">
    {#if title}<p class="font-semibold text-primary">{title}</p>{/if}
    <div class={title ? 'mt-1' : ''}>{@render children?.()}</div>
  </div>
</div>

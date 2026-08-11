<script lang="ts">
  import { cn } from '$lib/utils';
  import type { Tone } from './types';

  let {
    tone = 'neutral',
    pulse = false,
    size = 8,
    class: className = ''
  }: {
    tone?: Tone;
    /** Animate a soft halo — reserve for genuinely live/resolving states. */
    pulse?: boolean;
    size?: number;
    class?: string;
  } = $props();

  const bg: Record<Tone, string> = {
    neutral: 'bg-muted',
    action: 'bg-action',
    intel: 'bg-intel',
    focus: 'bg-focus',
    attention: 'bg-attention',
    success: 'bg-success',
    danger: 'bg-danger'
  };
</script>

<span class={cn('relative inline-flex', className)} style={`width:${size}px;height:${size}px`}>
  {#if pulse}
    <span class={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', bg[tone])}
    ></span>
  {/if}
  <span class={cn('relative inline-flex h-full w-full rounded-full', bg[tone])}></span>
</span>

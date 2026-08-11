<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';
  import type { Tone } from './types';
  import StatusDot from './StatusDot.svelte';

  // A restrained live-object treatment for embedded intelligence (Vesper Violet).
  type State = 'idle' | 'resolving' | 'applied' | 'failed' | 'stale';

  let {
    label = 'Prompt',
    state = 'idle',
    class: className = '',
    children,
    actions
  }: {
    label?: string;
    state?: State;
    class?: string;
    children?: Snippet;
    actions?: Snippet;
  } = $props();

  const map: Record<State, { tone: Tone; text: string; pulse: boolean }> = {
    idle: { tone: 'intel', text: 'Ready', pulse: false },
    resolving: { tone: 'focus', text: 'Resolving', pulse: true },
    applied: { tone: 'success', text: 'Applied', pulse: false },
    failed: { tone: 'danger', text: 'Failed', pulse: false },
    stale: { tone: 'attention', text: 'Stale', pulse: false }
  };

  const s = $derived(map[state]);
</script>

<div class={cn('rounded-panel border border-intel/30 bg-intel/6 p-3', className)}>
  <div class="flex items-center justify-between gap-3">
    <div class="flex items-center gap-2">
      <svg
        class="size-4 text-intel"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"><path d="M12 3l2.2 6.3L21 12l-6.8 2.7L12 21l-2.2-6.3L3 12l6.8-2.7z" /></svg
      >
      <span class="text-label font-semibold text-intel">{label}</span>
    </div>
    <span class="flex items-center gap-1.5 text-caption text-muted">
      <StatusDot tone={s.tone} pulse={s.pulse} size={7} />
      {s.text}
    </span>
  </div>
  <div class="mt-2 font-mono text-mono text-secondary">{@render children?.()}</div>
  {#if actions}<div class="mt-3 flex items-center gap-2">{@render actions()}</div>{/if}
</div>

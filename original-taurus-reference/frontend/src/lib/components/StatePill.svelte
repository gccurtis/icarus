<script lang="ts">
  import { cn } from '$lib/utils';
  import type { Tone } from './types';
  import StatusDot from './StatusDot.svelte';

  // The explicit state language from the interaction + quarterback specs.
  type State =
    | 'idle'
    | 'focused'
    | 'resolving'
    | 'running'
    | 'needs-review'
    | 'applied'
    | 'failed'
    | 'stale';

  let {
    state = 'idle',
    label = undefined,
    class: className = ''
  }: {
    state?: State;
    label?: string;
    class?: string;
  } = $props();

  const map: Record<State, { label: string; tone: Tone; pulse?: boolean }> = {
    idle: { label: 'Idle', tone: 'neutral' },
    focused: { label: 'Focused', tone: 'focus' },
    resolving: { label: 'Resolving', tone: 'focus', pulse: true },
    running: { label: 'Agent running', tone: 'intel', pulse: true },
    'needs-review': { label: 'Needs review', tone: 'attention' },
    applied: { label: 'Applied', tone: 'success' },
    failed: { label: 'Failed', tone: 'danger' },
    stale: { label: 'Stale', tone: 'attention' }
  };

  const s = $derived(map[state]);
</script>

<span
  class={cn(
    'inline-flex items-center gap-1.5 rounded-control border border-border bg-panel px-2 py-0.5 text-caption font-medium text-secondary',
    className
  )}
>
  <StatusDot tone={s.tone} pulse={s.pulse} />
  {label ?? s.label}
</span>

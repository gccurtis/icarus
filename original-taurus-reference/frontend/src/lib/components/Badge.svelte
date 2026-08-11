<script lang="ts">
  // Badge — a small inline pill for status/labels (e.g. "Saved", "Mock", counts).
  // Purely presentational: it renders its children inside a tinted, bordered chip
  // whose colour is driven by a semantic `tone`.
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';
  import type { Tone } from './types';

  let {
    tone = 'neutral',
    class: className = '',
    children,
    ...rest
  }: {
    /** Semantic colour of the pill (maps to a token set in `tones` below). */
    tone?: Tone;
    /** Extra classes merged after the tone/base classes (last wins via `cn`). */
    class?: string;
    /** Pill contents. */
    children?: Snippet;
    /** Any other attributes (e.g. `title`, `aria-*`) are spread onto the span. */
    [key: string]: unknown;
  } = $props();

  // Each tone maps to background / text / border utility classes, all keyed off a
  // single design token so light/dark themes stay consistent.
  const tones: Record<Tone, string> = {
    neutral: 'bg-panel text-secondary border-border',
    action: 'bg-action/12 text-action border-action/25',
    intel: 'bg-intel/12 text-intel border-intel/25',
    focus: 'bg-focus/12 text-focus border-focus/25',
    attention: 'bg-attention/12 text-attention border-attention/30',
    success: 'bg-success/12 text-success border-success/25',
    danger: 'bg-danger/12 text-danger border-danger/25'
  };
</script>

<!-- The pill: base layout + the selected tone's colours + any caller overrides. -->
<span
  class={cn(
    'inline-flex items-center gap-1 rounded-control border px-2 py-0.5 text-caption font-medium',
    tones[tone],
    className
  )}
  {...rest}
>
  {@render children?.()}
</span>

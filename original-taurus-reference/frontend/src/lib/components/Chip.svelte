<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';
  import type { Tone } from './types';

  let {
    tone = 'neutral',
    onremove = undefined,
    class: className = '',
    children
  }: {
    tone?: Tone;
    /** When provided, renders a remove affordance. */
    onremove?: () => void;
    class?: string;
    children?: Snippet;
  } = $props();

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

<span
  class={cn(
    'inline-flex items-center gap-1 rounded-control border px-2 py-0.5 text-caption font-medium',
    tones[tone],
    className
  )}
>
  {@render children?.()}
  {#if onremove}
    <button
      type="button"
      aria-label="Remove"
      onclick={onremove}
      class="dur-micro -mr-0.5 rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
    >
      <svg
        class="size-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  {/if}
</span>

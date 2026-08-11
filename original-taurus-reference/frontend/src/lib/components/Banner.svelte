<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';
  import type { Tone } from './types';

  let {
    tone = 'action',
    dismissible = false,
    ondismiss = undefined,
    class: className = '',
    children
  }: {
    tone?: Tone;
    dismissible?: boolean;
    ondismiss?: () => void;
    class?: string;
    children?: Snippet;
  } = $props();

  const tones: Record<Tone, string> = {
    neutral: 'bg-panel text-secondary',
    action: 'bg-action text-action-fg',
    intel: 'bg-intel text-white',
    focus: 'bg-focus text-white',
    attention: 'bg-attention text-white',
    success: 'bg-success text-white',
    danger: 'bg-danger text-white'
  };
</script>

<div class={cn('flex items-center gap-3 px-4 py-2 text-body-sm', tones[tone], className)}>
  <div class="flex-1">{@render children?.()}</div>
  {#if dismissible}
    <button
      type="button"
      aria-label="Dismiss"
      onclick={ondismiss}
      class="dur-micro rounded-full p-1 opacity-80 transition-opacity hover:opacity-100"
    >
      <svg
        class="size-4"
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
</div>
